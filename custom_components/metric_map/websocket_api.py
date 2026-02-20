"""WebSocket API for Metric Map."""

from __future__ import annotations

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN


@websocket_api.websocket_command(
    {
        vol.Required("type"): "metric_map/list",
    }
)
@websocket_api.async_response
async def websocket_list_maps(hass: HomeAssistant, connection, msg):
    """List Metric Map entries."""
    entries: list[ConfigEntry] = hass.config_entries.async_entries(DOMAIN)
    payload = []
    for entry in entries:
        merged = dict(entry.data)
        merged.update(entry.options)
        payload.append(
            {
                "entry_id": entry.entry_id,
                "title": entry.title,
                "config": merged,
            }
        )

    connection.send_result(msg["id"], payload)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "metric_map/get",
        vol.Required("entry_id"): str,
    }
)
@websocket_api.async_response
async def websocket_get_map(hass: HomeAssistant, connection, msg):
    """Get one Metric Map entry."""
    entry = hass.config_entries.async_get_entry(msg["entry_id"])
    if not entry or entry.domain != DOMAIN:
        connection.send_error(msg["id"], "not_found", "Metric Map entry not found")
        return

    merged = dict(entry.data)
    merged.update(entry.options)
    connection.send_result(
        msg["id"],
        {
            "entry_id": entry.entry_id,
            "title": entry.title,
            "config": merged,
        },
    )


def async_register_websocket_api(hass: HomeAssistant) -> None:
    """Register WebSocket API commands."""
    websocket_api.async_register_command(hass, websocket_list_maps)
    websocket_api.async_register_command(hass, websocket_get_map)
