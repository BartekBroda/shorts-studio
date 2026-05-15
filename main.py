import fcntl
import os
import sys
import webview
from backend.api import API

# ── Single-instance enforcement ───────────────────────────────────────────────
_LOCK_PATH = os.path.expanduser('~/.config/shorts-studio/instance.lock')
_lock_fh = None  # held for process lifetime to keep the flock active


def _acquire_single_instance() -> None:
    global _lock_fh
    os.makedirs(os.path.dirname(_LOCK_PATH), exist_ok=True)
    # 'a+' keeps existing content so flock failure can still read the incumbent PID
    fh = open(_LOCK_PATH, 'a+')
    try:
        fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
        # We won — truncate stale content, write our PID
        fh.seek(0)
        fh.truncate()
        fh.write(str(os.getpid()) + '\n')
        fh.flush()
        _lock_fh = fh  # prevent GC — lock released when process exits
    except OSError:
        fh.close()
        _activate_existing_instance()
        sys.exit(0)


def _activate_existing_instance() -> None:
    try:
        with open(_LOCK_PATH) as f:
            pid_str = f.read().strip()
        if not pid_str:
            return
        pid = int(pid_str)
        from AppKit import NSRunningApplication
        app = NSRunningApplication.runningApplicationWithProcessIdentifier_(pid)
        if app:
            app.activateWithOptions_(1 << 0)  # NSApplicationActivateIgnoringOtherApps
    except Exception as e:
        print(f'[shorts-studio] could not activate existing instance: {e}')


_acquire_single_instance()
# ─────────────────────────────────────────────────────────────────────────────

# .app bundles launch without shell PATH — inject Homebrew so all subprocesses
# (ffmpeg, ffprobe, whisper-cli) resolve without hardcoding paths everywhere.
for _brew_path in ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin']:
    if os.path.isdir(_brew_path) and _brew_path not in os.environ.get('PATH', ''):
        os.environ['PATH'] = _brew_path + ':' + os.environ.get('PATH', '')

DEV = "--dev" in sys.argv

if DEV:
    URL = "http://localhost:5173"
elif getattr(sys, "_MEIPASS", None):
    # PyInstaller bundle: data files land in sys._MEIPASS
    URL = os.path.join(sys._MEIPASS, "www", "index.html")
else:
    URL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "www", "index.html")

# Module-level refs prevent garbage collection.
_win = None
_about_target = None
_settings_target = None
_undo_target = None
_redo_target = None
_interceptor = None
_can_undo = False
_can_redo = False

try:
    from AppKit import NSApplication, NSMenuItem, NSObject

    class _AboutTarget(NSObject):
        """Receives the About menu action and fires our JS modal."""
        def openAbout_(self, sender):
            if _win:
                import threading
                threading.Thread(
                    target=_win.evaluate_js,
                    args=("window.dispatchEvent(new CustomEvent('shorts-studio:open-about'))",),
                    daemon=True,
                ).start()

    class _SettingsTarget(NSObject):
        """Receives the Settings menu action and fires our JS modal."""
        def openSettings_(self, sender):
            if _win:
                import threading
                threading.Thread(
                    target=_win.evaluate_js,
                    args=("window.dispatchEvent(new CustomEvent('shorts-studio:open-settings'))",),
                    daemon=True,
                ).start()

    class _UndoTarget(NSObject):
        def undo_(self, sender):
            if _win:
                import threading
                threading.Thread(
                    target=_win.evaluate_js,
                    args=("window.dispatchEvent(new CustomEvent('shorts-studio:undo'))",),
                    daemon=True,
                ).start()

        def validateMenuItem_(self, menuItem):
            return bool(_can_undo)

    class _RedoTarget(NSObject):
        def redo_(self, sender):
            if _win:
                import threading
                threading.Thread(
                    target=_win.evaluate_js,
                    args=("window.dispatchEvent(new CustomEvent('shorts-studio:redo'))",),
                    daemon=True,
                ).start()

        def validateMenuItem_(self, menuItem):
            return bool(_can_redo)

    class _Interceptor(NSObject):
        """Runs on the main thread to patch About, add Settings Cmd+,, and wire Undo/Redo."""
        def run_(self, _):
            global _about_target, _settings_target, _undo_target, _redo_target
            try:
                _about_target = _AboutTarget.alloc().init()
                _settings_target = _SettingsTarget.alloc().init()
                _undo_target = _UndoTarget.alloc().init()
                _redo_target = _RedoTarget.alloc().init()

                ns_app = NSApplication.sharedApplication()
                menu = ns_app.mainMenu()
                if not menu:
                    return
                app_item = menu.itemAtIndex_(0)
                if not app_item:
                    return
                submenu = app_item.submenu()
                if not submenu:
                    return

                about_idx = -1
                for i in range(submenu.numberOfItems()):
                    item = submenu.itemAtIndex_(i)
                    if item and "About" in (item.title() or ""):
                        item.setTitle_("About Shorts Studio")
                        item.setTarget_(_about_target)
                        item.setAction_(b"openAbout:")
                        about_idx = i
                        break

                # Remove any existing Preferences/Settings item first.
                for i in range(submenu.numberOfItems() - 1, -1, -1):
                    item = submenu.itemAtIndex_(i)
                    t = item.title() if item else ""
                    if t and ("Preferences" in t or "Settings" in t):
                        submenu.removeItemAtIndex_(i)

                # Insert Settings... + separator right after About (or at top).
                insert_at = about_idx + 1 if about_idx >= 0 else 0
                sep = NSMenuItem.separatorItem()
                submenu.insertItem_atIndex_(sep, insert_at)
                settings_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
                    "Settings…", b"openSettings:", ","
                )
                settings_item.setTarget_(_settings_target)
                settings_item.setKeyEquivalentModifierMask_(1 << 20)  # NSEventModifierFlagCommand
                submenu.insertItem_atIndex_(settings_item, insert_at)

                # Wire Undo/Redo in Edit menu — remove existing items, insert ours
                edit_submenu = None
                for mi in range(menu.numberOfItems()):
                    edit_item = menu.itemAtIndex_(mi)
                    if edit_item and edit_item.submenu():
                        t = edit_item.title() or ""
                        if "Edit" in t or "edit" in t:
                            edit_submenu = edit_item.submenu()
                            break

                if edit_submenu is None:
                    # Create Edit menu if PyWebView didn't make one
                    edit_menu_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
                        "Edit", None, ""
                    )
                    from AppKit import NSMenu
                    edit_submenu_obj = NSMenu.alloc().initWithTitle_("Edit")
                    edit_menu_item.setSubmenu_(edit_submenu_obj)
                    menu.insertItem_atIndex_(edit_menu_item, 1)
                    edit_submenu = edit_submenu_obj

                # Remove any existing Undo/Redo items
                for j in range(edit_submenu.numberOfItems() - 1, -1, -1):
                    ei = edit_submenu.itemAtIndex_(j)
                    if ei:
                        kv = ei.keyEquivalent() or ""
                        if kv.lower() == "z":
                            edit_submenu.removeItemAtIndex_(j)

                # Insert Undo then Redo at top of Edit menu
                NSEventModifierFlagCommand = 1 << 20
                NSEventModifierFlagShift = 1 << 17
                undo_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
                    "Undo", b"undo:", "z"
                )
                undo_item.setTarget_(_undo_target)
                undo_item.setKeyEquivalentModifierMask_(NSEventModifierFlagCommand)
                edit_submenu.insertItem_atIndex_(undo_item, 0)

                redo_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
                    "Redo", b"redo:", "z"
                )
                redo_item.setTarget_(_redo_target)
                redo_item.setKeyEquivalentModifierMask_(
                    NSEventModifierFlagCommand | NSEventModifierFlagShift
                )
                edit_submenu.insertItem_atIndex_(redo_item, 1)
            except Exception as e:
                print(f"[shorts-studio] intercept error: {e}")

    _HAS_APPKIT = True
except ImportError:
    _HAS_APPKIT = False


def _setup_menu(win):
    """Called from PyWebView's func thread — dispatches menu patching to main thread."""
    global _win, _interceptor
    if not _HAS_APPKIT:
        return
    _win = win
    _interceptor = _Interceptor.alloc().init()
    _interceptor.performSelectorOnMainThread_withObject_waitUntilDone_(
        b"run:", None, False
    )


if __name__ == "__main__":
    api = API()
    window = webview.create_window(
        "Shorts Studio",
        URL,
        js_api=api,
        width=1100,
        height=750,
        min_size=(900, 600),
    )
    webview.start(debug=DEV, func=lambda: _setup_menu(window))
