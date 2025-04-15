from homeassistant.helpers.entity import Entity
from homeassistant.components.sensor import SensorEntity

class TemperatureSensor(SensorEntity):
    def __init__(self, name, temperature):
        self._name = name
        self._temperature = temperature

    @property
    def name(self):
        return self._name

    @property
    def state(self):
        return self._temperature

    @property
    def icon(self):
        return "mdi:thermometer"
