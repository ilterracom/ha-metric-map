import logging
from homeassistant import config_entries
from homeassistant.const import CONF_IMAGE, CONF_SENSORS
import voluptuous as vol
from homeassistant.helpers import selector

_LOGGER = logging.getLogger(__name__)


class TemperatureMapConfigFlow(config_entries.ConfigFlow):
    """Handle a config flow for Metric Map integration."""

    VERSION = 1
    CONF_PATH = "image_path"
    CONF_SENSOR_IDS = "sensor_ids"

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        errors = {}

        if user_input is not None:
            image_path = user_input.get(self.CONF_PATH)
            sensor_ids = user_input.get(self.CONF_SENSOR_IDS)

            # Save configuration
            self.hass.data[self.entry_id] = {
                self.CONF_PATH: image_path,
                self.CONF_SENSOR_IDS: sensor_ids,
            }

            return self.async_create_entry(
                title="Metric Map", data=user_input
            )

        # Show UI to input path and sensor IDs
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(self.CONF_PATH): selector.Selector(
                    selector.SelectorType.FILE
                ),
                vol.Required(self.CONF_SENSOR_IDS): selector.Selector(
                    selector.SelectorType.SELECT_MULTI,
                    options=[(sensor.entity_id, sensor.entity_id) for sensor in self.hass.states.all() if
                             "sensor." in sensor.entity_id]
                )
            }),
            errors=errors
        )
