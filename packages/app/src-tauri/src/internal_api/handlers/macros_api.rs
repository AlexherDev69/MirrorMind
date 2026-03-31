use axum::{extract::{Path, State}, response::IntoResponse};
use std::sync::Arc;

use crate::internal_api::auth::ApiState;
use super::common::*;

pub async fn list_macros_handler(
    State(state): State<Arc<ApiState>>,
) -> Result<impl IntoResponse, ApiError> {
    let macros = crate::commands::macros::list_macros_internal(&state.app_handle)?;
    Ok(ok_json(macros))
}

pub async fn load_macro_handler(
    State(state): State<Arc<ApiState>>,
    Path(name): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let content = crate::commands::macros::load_macro_internal(&state.app_handle, &name)?;
    Ok(ok_json(content))
}
