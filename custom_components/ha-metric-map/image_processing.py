import numpy as np
import matplotlib.pyplot as plt
from scipy.interpolate import griddata

def generate_temperature_map(sensor_data):
    grid_x, grid_y = np.mgrid[0:1:100j, 0:1:100j]
    points = list(sensor_data.keys())
    values = list(sensor_data.values())

    grid_z = griddata(points, values, (grid_x, grid_y), method='cubic')

    plt.imshow(grid_z.T, extent=(0, 1, 0, 1), origin='lower', cmap='coolwarm')
    plt.colorbar(label='Temperature (°C)')
    plt.savefig('/config/www/temperature_map.png')
