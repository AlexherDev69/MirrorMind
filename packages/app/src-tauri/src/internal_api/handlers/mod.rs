mod common;
mod device_control;
mod device_info;
mod navigation;
mod macros_api;

// Re-export all handlers for server.rs routing
pub use common::{health_handler, ApiError, ApiResponse};
pub use device_control::{
    screenshot_handler, tap_handler, swipe_handler, type_text_handler,
    key_press_handler, display_size_handler,
};
pub use device_info::{devices_handler, device_info_handler, stream_status_handler};
pub use navigation::{
    current_activity_handler, run_app_handler, deep_link_handler, ui_tree_handler,
};
pub use macros_api::{list_macros_handler, load_macro_handler};
