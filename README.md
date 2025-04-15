# Metric Map

**Metric Map** is an integration for Home Assistant that allows you to visualize data from various sensors on **gradient temperature maps**. You can display values from temperature, humidity, power consumption, air pollution, and other metrics, as well as track their distribution across a room or throughout your home.

## Main Goal

The **Metric Map** integration allows users to:

- Create maps with gradient overlays that display sensor data on a pre-uploaded floorplan.
- Support different types of sensors, including:
  - Temperature
  - Humidity
  - Power Consumption
  - Air Pollution
  - And other metrics that can be represented as numerical values.

## Features

- **Flexibility**: Users can upload their own floorplans and configure the display of data from various sensors on these maps.
- **Gradients**: The maps are displayed with gradients, making it easy to visualize the distribution of values across a room or home.
- **Multiple Sensor Support**: The integration supports different types of sensors, such as temperature and humidity sensors, as well as other measuring devices integrated into Home Assistant.

## Installation

1. **Via HACS**:
   - Go to **HACS** → **Integrations**.
   - Click **Explore & Download Repositories**.
   - Search for **Metric Map** and install it.

2. **Manual Installation**:
   - Download or clone the repository into the `/custom_components` folder of your Home Assistant:
     ```bash
     cd /config/custom_components
     git clone https://github.com/your_username/metric_map.git
     ```
   - Restart Home Assistant.

## Configuration

After installing **Metric Map**, you need to configure it through the Home Assistant interface.

1. Go to **Configuration** → **Integrations**.
2. Find **Metric Map** and add it.
3. During configuration, you will be able to:
   - Set the path to the floorplan image.
   - Choose the sensors whose data will be displayed on the map.
   - Configure how different metrics are displayed using color gradients.

## Example Usage

To display a temperature map, you need to upload a floorplan image and configure the placement of temperature, humidity, and other sensor coordinates. The integration will then automatically create a gradient map that displays data from these sensors.

### Example Configuration

```yaml
type: picture-elements
image: /local/house_map.png  # Path to the floorplan image
elements:
  - type: state-icon
    entity: sensor.living_room_temperature
    style:
      top: 20%
      left: 40%
      color: "rgba(255, 0, 0, 0.8)"  # Color depending on temperature
  - type: state-icon
    entity: sensor.bedroom_temperature
    style:
      top: 60%
      left: 50%
      color: "rgba(0, 0, 255, 0.8)"  # Color depending on temperature
