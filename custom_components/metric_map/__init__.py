"""Metric Map integration."""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .websocket_api import async_register_websocket_api

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[str] = []


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up Metric Map from YAML."""
    static_dir = Path(__file__).parent / "www"
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                "/metric_map_static",
                str(static_dir),
                cache_headers=False,
            )
        ]
    )

    # Compatibility across HA frontend API versions.
    frontend = hass.components.frontend
    if hasattr(frontend, "async_register_extra_module_url"):
        frontend.async_register_extra_module_url("/metric_map_static/metric-map-card.js")
    elif hasattr(frontend, "async_register_extra_js_url"):
        frontend.async_register_extra_js_url("/metric_map_static/metric-map-card.js")
    else:
        _LOGGER.warning(
            "Could not auto-register Metric Map card resource. "
            "Add /metric_map_static/metric-map-card.js manually in Lovelace resources."
        )

    async_register_websocket_api(hass)
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Metric Map from a config entry."""
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = entry
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    hass.data[DOMAIN].pop(entry.entry_id, None)
    return True
