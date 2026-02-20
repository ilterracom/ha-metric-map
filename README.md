# Metric Map for Home Assistant

`Metric Map` is a custom Home Assistant integration + Lovelace card for drawing a live heatmap on top of a floor/room image.

You can:
- upload/select a map image;
- place sensor points by coordinates (X/Y in %);
- render a semi-transparent gradient layer from live sensor values;
- visualize temperature, humidity, voltage, Wi-Fi signal, or any numeric sensor values.

## What is implemented

- Config Flow for creating a map entry in Home Assistant UI.
- Options Flow for managing sensor points:
  - add point (`sensor` entity + X/Y coordinates + label),
  - remove point,
  - adjust gradient settings.
- Built-in custom card: `custom:metric-map-card`.
- Visual card editor in Lovelace UI (no manual YAML required):
  - mode 1: use integration entry,
  - mode 2: configure image + points directly in card editor.
- Live updates from Home Assistant states.
- WebSocket API for the card:
  - `metric_map/list`
  - `metric_map/get`

## Installation

### HACS (custom repository)
1. Add repository URL to HACS custom repositories.
2. Install `Metric Map`.
3. Restart Home Assistant.

### Manual
1. Copy `custom_components/metric_map` into `<config>/custom_components/metric_map`.
2. Restart Home Assistant.

## Setup in Home Assistant

1. Go to `Settings -> Devices & Services -> Add Integration`.
2. Search `Metric Map`.
3. Fill base settings:
   - `Map image`
   - optional unit/min/max
   - gradient opacity and color scheme.
4. Open integration `Configure` (Options) and add points with sensor + X/Y.

## Lovelace usage

### Visual editor (recommended)

1. Open dashboard in edit mode.
2. Click `Add Card`.
3. Select `Metric Map Card`.
4. Choose one mode:
   - `Use integration`: pick existing map entry.
   - `Configure in card`: choose image, add sensors, set coordinates.
5. Save card.

### YAML (optional)

```yaml
type: custom:metric-map-card
entry_id: YOUR_CONFIG_ENTRY_ID
```

Or manual config:

```yaml
type: custom:metric-map-card
image_path: /local/floorplan.png
unit: "°C"
gradient_opacity: 0.55
color_scheme: blue_red
show_markers: true
points:
  - entity_id: sensor.living_room_temperature
    x: 20
    y: 35
    label: Living room
  - entity_id: sensor.bedroom_temperature
    x: 70
    y: 60
    label: Bedroom
```

## Notes

- Best results when all selected sensors use the same unit.
- Coordinates are in percentages of image width/height.
- If you use `media-source://` images, the card resolves them automatically.
