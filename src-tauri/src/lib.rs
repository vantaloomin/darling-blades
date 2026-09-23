use std::sync::{Arc, OnceLock};

use tauri::{
  webview::NewWindowResponse, AppHandle, Manager, Runtime, Url, WebviewUrl, WebviewWindowBuilder,
  WindowEvent,
};

/// The game's window. The capability in `capabilities/default.json` names it.
const MAIN_WINDOW: &str = "main";

/// The one window the game's own pages (privacy policy, terms, notices) open
/// in. No capability names it, so a page shown there has no access to Tauri's
/// IPC.
const PAGE_WINDOW: &str = "page";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // The main window is built here rather than by the config (`create:
      // false` in tauri.conf.json) for one reason: `on_new_window` can only be
      // attached by a builder. With no handler, wry answers WebView2's
      // NewWindowRequested with `SetHandled(true)` and nothing else, which
      // cancels every `window.open` silently: every legal link in the game
      // opened nothing (wry 0.55.1, src/webview2/mod.rs).
      let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == MAIN_WINDOW)
        .cloned()
        .ok_or("tauri.conf.json has no window labelled \"main\"")?;
      // The game's own address, recorded from the main window's first real
      // navigation. Read back from the window straight after `build` it is
      // still `about:blank` (measured on a release build, 2026-09-23), which
      // matched nothing and refused every page.
      let app_url: Arc<OnceLock<Url>> = Arc::default();
      let navigated_url = app_url.clone();
      let handler_url = app_url.clone();
      let handle = app.handle().clone();
      WebviewWindowBuilder::from_config(app.handle(), &config)?
        .on_navigation(move |url| {
          if url.scheme() != "about" {
            let _ = navigated_url.set(url.clone());
          }
          true
        })
        .on_new_window(move |url, _features| {
          // Only the game's own pages open, and in a window this shell makes:
          // the popup WebView2 would make by itself has no handler for the
          // app's own address, so it could not show a bundled page offline.
          if let Some(app_url) = handler_url.get() {
            if same_origin(&url, app_url) {
              open_page_window(&handle, url, app_url.clone());
            }
          }
          NewWindowResponse::Deny
        })
        .build()?;
      Ok(())
    })
    .on_window_event(|window, event| {
      // The page window must not outlive the game: with it still open the app
      // would keep running with no game in it.
      if window.label() == MAIN_WINDOW && matches!(event, WindowEvent::Destroyed) {
        window.app_handle().exit(0);
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/// Show `url` in the page window: made if it is not open yet, navigated and
/// brought forward if it is, so a second page opened from the game replaces
/// the first instead of stacking windows.
fn open_page_window<R: Runtime>(app: &AppHandle<R>, url: Url, app_url: Url) {
  if let Some(existing) = app.get_webview_window(PAGE_WINDOW) {
    let _ = existing.navigate(url);
    let _ = existing.unminimize();
    let _ = existing.set_focus();
    return;
  }

  // The page's address relative to the app, so one path serves the bundled
  // pages in a release build and the dev server's pages under `tauri dev`.
  let mut relative = url.path().trim_start_matches('/').to_string();
  if let Some(query) = url.query() {
    relative.push('?');
    relative.push_str(query);
  }
  let handle = app.clone();
  let built = WebviewWindowBuilder::new(app, PAGE_WINDOW, WebviewUrl::App(relative.into()))
    .title("Darling Blades")
    .inner_size(860.0, 700.0)
    .min_inner_size(480.0, 360.0)
    .center()
    .theme(Some(tauri::Theme::Dark))
    .on_document_title_changed(|window, title| {
      let _ = window.set_title(&title);
    })
    .on_navigation(move |target| {
      // Every page's "Back to the game" link points at the app's root, which
      // here would start a second copy of the game in this window. So that
      // link closes the window instead, which leaves the player in the game.
      // The close runs once this callback has returned: a window cannot be
      // torn down from inside its own navigation event.
      if same_origin(target, &app_url) && is_game_root(target) {
        let handle = handle.clone();
        std::thread::spawn(move || {
          if let Some(page) = handle.get_webview_window(PAGE_WINDOW) {
            let _ = page.close();
          }
          if let Some(main) = handle.get_webview_window(MAIN_WINDOW) {
            let _ = main.set_focus();
          }
        });
        return false;
      }
      true
    })
    .build();
  if let Err(error) = built {
    log::warn!("could not open the page window: {error}");
  }
}

/// Scheme, host and port, compared by hand: `Url::origin()` makes every
/// `tauri://` origin opaque, and an opaque origin never equals another.
fn same_origin(a: &Url, b: &Url) -> bool {
  a.scheme() == b.scheme()
    && a.host_str() == b.host_str()
    && a.port_or_known_default() == b.port_or_known_default()
}

/// The address that loads the game itself.
fn is_game_root(url: &Url) -> bool {
  matches!(url.path(), "" | "/" | "/index.html")
}
