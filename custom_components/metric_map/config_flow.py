"""Config flow for Metric Map integration."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_ENTITY_ID, CONF_NAME
from homeassistant.helpers import selector

from .const import (
    CONF_COLOR_SCHEME,
    CONF_GRADIENT_OPACITY,
    CONF_IMAGE_PATH,
    CONF_MAX_VALUE,
    CONF_MIN_VALUE,
    CONF_POINTS,
    CONF_SHOW_MARKERS,
    CONF_UNIT,
    DEFAULT_COLOR_SCHEME,
    DEFAULT_GRADIENT_OPACITY,
    DEFAULT_SHOW_MARKERS,
    DEFAULT_TITLE,
    DOMAIN,
)

COLOR_SCHEMES = ["blue_red", "green_red", "viridis", "plasma"]


class MetricMapConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Metric Map."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        """Handle the initial step."""
        if user_input is not None:
            user_input.setdefault(CONF_POINTS, [])
            user_input.setdefault(CONF_GRADIENT_OPACITY, DEFAULT_GRADIENT_OPACITY)
            user_input.setdefault(CONF_COLOR_SCHEME, DEFAULT_COLOR_SCHEME)
            user_input.setdefault(CONF_SHOW_MARKERS, DEFAULT_SHOW_MARKERS)
            return self.async_create_entry(
                title=user_input[CONF_NAME],
                data=user_input,
            )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_NAME, default=DEFAULT_TITLE): selector.TextSelector(),
                    vol.Required(CONF_IMAGE_PATH): selector.FileSelector(
                        selector.FileSelectorConfig(
                            accept="image/*",
                        )
                    ),
                    vol.Optional(CONF_UNIT, default=""): selector.TextSelector(),
                    vol.Optional(CONF_MIN_VALUE): selector.NumberSelector(
                        selector.NumberSelectorConfig(mode=selector.NumberSelectorMode.BOX)
                    ),
                    vol.Optional(CONF_MAX_VALUE): selector.NumberSelector(
                        selector.NumberSelectorConfig(mode=selector.NumberSelectorMode.BOX)
                    ),
                    vol.Optional(
                        CONF_GRADIENT_OPACITY, default=DEFAULT_GRADIENT_OPACITY
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            min=0,
                            max=1,
                            step=0.05,
                            mode=selector.NumberSelectorMode.SLIDER,
                        )
                    ),
                    vol.Optional(CONF_COLOR_SCHEME, default=DEFAULT_COLOR_SCHEME): selector.SelectSelector(
                        selector.SelectSelectorConfig(options=COLOR_SCHEMES)
                    ),
                    vol.Optional(CONF_SHOW_MARKERS, default=DEFAULT_SHOW_MARKERS): selector.BooleanSelector(),
                }
            ),
        )

    @staticmethod
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        """Return options flow."""
        return MetricMapOptionsFlow(config_entry)


class MetricMapOptionsFlow(config_entries.OptionsFlow):
    """Handle options for Metric Map."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self._entry = config_entry
        self._options: dict[str, Any] = dict(config_entry.data)
        self._options.update(config_entry.options)
        self._points = list(self._options.get(CONF_POINTS, []))

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        """Manage base options and routing."""
        if user_input is not None:
            action = user_input.pop("action")
            self._options.update(user_input)
            self._options[CONF_POINTS] = self._points

            if action == "manage_points":
                return await self.async_step_points_menu()

            return self.async_create_entry(title="", data=self._options)

        schema: dict[Any, Any] = {
            vol.Required(
                CONF_IMAGE_PATH,
                default=self._options.get(CONF_IMAGE_PATH, self._entry.data.get(CONF_IMAGE_PATH, "")),
            ): selector.FileSelector(selector.FileSelectorConfig(accept="image/*")),
            vol.Optional(CONF_UNIT, default=self._options.get(CONF_UNIT, "")): selector.TextSelector(),
            vol.Optional(
                CONF_GRADIENT_OPACITY,
                default=self._options.get(CONF_GRADIENT_OPACITY, DEFAULT_GRADIENT_OPACITY),
            ): selector.NumberSelector(
                selector.NumberSelectorConfig(
                    min=0,
                    max=1,
                    step=0.05,
                    mode=selector.NumberSelectorMode.SLIDER,
                )
            ),
            vol.Optional(
                CONF_COLOR_SCHEME,
                default=self._options.get(CONF_COLOR_SCHEME, DEFAULT_COLOR_SCHEME),
            ): selector.SelectSelector(selector.SelectSelectorConfig(options=COLOR_SCHEMES)),
            vol.Optional(
                CONF_SHOW_MARKERS,
                default=self._options.get(CONF_SHOW_MARKERS, DEFAULT_SHOW_MARKERS),
            ): selector.BooleanSelector(),
            vol.Required("action", default="save"): selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=["save", "manage_points"],
                    translation_key="options_action",
                )
            ),
        }

        if self._options.get(CONF_MIN_VALUE) is not None:
            schema[vol.Optional(CONF_MIN_VALUE, default=self._options.get(CONF_MIN_VALUE))] = selector.NumberSelector(
                selector.NumberSelectorConfig(mode=selector.NumberSelectorMode.BOX)
            )
        else:
            schema[vol.Optional(CONF_MIN_VALUE)] = selector.NumberSelector(
                selector.NumberSelectorConfig(mode=selector.NumberSelectorMode.BOX)
            )

        if self._options.get(CONF_MAX_VALUE) is not None:
            schema[vol.Optional(CONF_MAX_VALUE, default=self._options.get(CONF_MAX_VALUE))] = selector.NumberSelector(
                selector.NumberSelectorConfig(mode=selector.NumberSelectorMode.BOX)
            )
        else:
            schema[vol.Optional(CONF_MAX_VALUE)] = selector.NumberSelector(
                selector.NumberSelectorConfig(mode=selector.NumberSelectorMode.BOX)
            )

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(schema),
            description_placeholders={"points_count": str(len(self._points))},
        )

    async def async_step_points_menu(self, user_input: dict[str, Any] | None = None):
        """Show points management menu."""
        if user_input is not None:
            action = user_input["action"]
            if action == "add":
                return await self.async_step_add_point()
            if action == "remove":
                return await self.async_step_remove_point()
            return await self.async_step_init()

        return self.async_show_form(
            step_id="points_menu",
            data_schema=vol.Schema(
                {
                    vol.Required("action", default="add"): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=["add", "remove", "done"],
                            translation_key="points_action",
                        )
                    )
                }
            ),
            description_placeholders={"points_count": str(len(self._points))},
        )

    async def async_step_add_point(self, user_input: dict[str, Any] | None = None):
        """Add a sensor point."""
        if user_input is not None:
            point = {
                "entity_id": user_input[CONF_ENTITY_ID],
                "x": float(user_input["x"]),
                "y": float(user_input["y"]),
                "label": user_input.get("label", ""),
            }
            self._points.append(point)
            return await self.async_step_points_menu()

        return self.async_show_form(
            step_id="add_point",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_ENTITY_ID): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain=["sensor"])
                    ),
                    vol.Required("x"): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            min=0,
                            max=100,
                            step=0.1,
                            unit_of_measurement="%",
                            mode=selector.NumberSelectorMode.BOX,
                        )
                    ),
                    vol.Required("y"): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            min=0,
                            max=100,
                            step=0.1,
                            unit_of_measurement="%",
                            mode=selector.NumberSelectorMode.BOX,
                        )
                    ),
                    vol.Optional("label", default=""): selector.TextSelector(),
                }
            ),
        )

    async def async_step_remove_point(self, user_input: dict[str, Any] | None = None):
        """Remove an existing point."""
        if user_input is not None:
            index = int(user_input["point_index"])
            if 0 <= index < len(self._points):
                self._points.pop(index)
            return await self.async_step_points_menu()

        options = [
            {
                "value": str(index),
                "label": f"{point['entity_id']} ({point['x']}%, {point['y']}%)",
            }
            for index, point in enumerate(self._points)
        ]

        if not options:
            return await self.async_step_points_menu()

        return self.async_show_form(
            step_id="remove_point",
            data_schema=vol.Schema(
                {
                    vol.Required("point_index"): selector.SelectSelector(
                        selector.SelectSelectorConfig(options=options)
                    )
                }
            ),
        )
