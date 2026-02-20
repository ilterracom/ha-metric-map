class MetricMapCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement("metric-map-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:metric-map-card",
    };
  }

  setConfig(config) {
    if (!config.entry_id && (!config.image_path || !config.points)) {
      throw new Error("Set entry_id or provide image_path + points");
    }
    this._config = config;
    this._resolvedImageUrl = null;
    this._entryPayload = null;
    this._entryLoadedAt = 0;
    this._ensureRoot();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) {
      return;
    }
    this._render();
  }

  connectedCallback() {
    this._ensureRoot();
  }

  getCardSize() {
    return 6;
  }

  _ensureRoot() {
    if (this.shadowRoot) {
      return;
    }

    const root = this.attachShadow({ mode: "open" });
    const card = document.createElement("ha-card");
    card.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          overflow: hidden;
          border-radius: 12px;
          background: #101219;
        }
        .base-image,
        .heatmap {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .heatmap {
          pointer-events: none;
        }
        .marker {
          position: absolute;
          transform: translate(-50%, -50%);
          font-size: 11px;
          line-height: 1.2;
          color: #fff;
          background: rgba(0, 0, 0, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 8px;
          padding: 2px 6px;
          white-space: nowrap;
          backdrop-filter: blur(4px);
        }
        .error {
          padding: 12px;
          color: var(--error-color);
        }
      </style>
      <div class="wrap">
        <img class="base-image" alt="Metric map background" />
        <canvas class="heatmap"></canvas>
      </div>
      <div class="error" hidden></div>
    `;
    root.appendChild(card);

    this._elements = {
      image: root.querySelector(".base-image"),
      canvas: root.querySelector(".heatmap"),
      wrap: root.querySelector(".wrap"),
      error: root.querySelector(".error"),
    };
  }

  async _render() {
    try {
      const mapConfig = await this._getEffectiveConfig();
      if (!mapConfig) {
        return;
      }

      const points = this._extractLivePoints(mapConfig);
      this._renderError("");

      await this._setImage(mapConfig.image_path);
      this._drawHeatmap(points, mapConfig);
      this._drawMarkers(points, mapConfig);
    } catch (error) {
      this._renderError(error instanceof Error ? error.message : String(error));
    }
  }

  _renderError(message) {
    this._elements.error.textContent = message;
    this._elements.error.hidden = !message;
  }

  async _getEffectiveConfig() {
    if (this._config.entry_id) {
      const isExpired = Date.now() - this._entryLoadedAt > 30000;
      if (!this._entryPayload || isExpired) {
        const payload = await this._hass.callWS({
          type: "metric_map/get",
          entry_id: this._config.entry_id,
        });
        this._entryPayload = payload;
        this._entryLoadedAt = Date.now();
      }
      return this._entryPayload.config;
    }

    return {
      image_path: this._config.image_path,
      points: this._config.points,
      unit: this._config.unit || "",
      min_value: this._config.min_value,
      max_value: this._config.max_value,
      gradient_opacity: this._config.gradient_opacity,
      color_scheme: this._config.color_scheme,
      show_markers: this._config.show_markers,
    };
  }

  _extractLivePoints(config) {
    const points = Array.isArray(config.points) ? config.points : [];
    const unit = config.unit || "";

    return points
      .map((point) => {
        const stateObj = this._hass.states[point.entity_id];
        if (!stateObj) {
          return null;
        }

        const value = Number.parseFloat(stateObj.state);
        if (Number.isNaN(value)) {
          return null;
        }

        return {
          ...point,
          value,
          valueText: `${stateObj.state}${unit ? ` ${unit}` : ""}`,
          name: point.label || stateObj.attributes.friendly_name || point.entity_id,
        };
      })
      .filter(Boolean);
  }

  async _setImage(imagePath) {
    const url = await this._resolveImageUrl(imagePath);
    if (this._elements.image.src !== url) {
      this._elements.image.src = url;
    }
    if (!this._elements.image.complete) {
      await new Promise((resolve, reject) => {
        this._elements.image.onload = () => resolve();
        this._elements.image.onerror = () => reject(new Error("Cannot load map image"));
      });
    }
  }

  async _resolveImageUrl(imagePath) {
    if (!imagePath) {
      throw new Error("image_path is empty");
    }

    if (this._resolvedImageUrl && this._resolvedImageUrl.path === imagePath) {
      return this._resolvedImageUrl.url;
    }

    let resolved = imagePath;
    if (imagePath.startsWith("media-source://")) {
      const media = await this._hass.callWS({
        type: "media_source/resolve_media",
        media_content_id: imagePath,
      });
      resolved = media?.url;
    } else if (imagePath.startsWith("/")) {
      resolved = this._hass.hassUrl(imagePath);
    }

    this._resolvedImageUrl = { path: imagePath, url: resolved };
    return resolved;
  }

  _drawHeatmap(points, config) {
    const image = this._elements.image;
    const canvas = this._elements.canvas;
    const width = image.clientWidth;
    const height = image.clientHeight;

    if (!width || !height || points.length === 0) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const gridW = 140;
    const gridH = Math.max(80, Math.round((height / width) * gridW));
    const imageData = ctx.createImageData(gridW, gridH);

    const values = points.map((p) => p.value);
    const configuredMin = Number(config.min_value);
    const configuredMax = Number(config.max_value);
    const minValue = Number.isFinite(configuredMin) ? configuredMin : Math.min(...values);
    const maxValue = Number.isFinite(configuredMax) ? configuredMax : Math.max(...values);
    const span = Math.max(maxValue - minValue, 0.0001);

    for (let gy = 0; gy < gridH; gy += 1) {
      for (let gx = 0; gx < gridW; gx += 1) {
        const px = (gx / (gridW - 1)) * 100;
        const py = (gy / (gridH - 1)) * 100;

        let weighted = 0;
        let weightSum = 0;

        for (const point of points) {
          const dx = px - point.x;
          const dy = py - point.y;
          const distSq = dx * dx + dy * dy;
          const weight = 1 / (distSq + 4);
          weighted += point.value * weight;
          weightSum += weight;
        }

        const interpolated = weighted / weightSum;
        const t = Math.min(1, Math.max(0, (interpolated - minValue) / span));
        const [r, g, b] = this._colorFromScale(t, config.color_scheme || "blue_red");

        const idx = (gy * gridW + gx) * 4;
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = gridW;
    tempCanvas.height = gridH;
    tempCanvas.getContext("2d").putImageData(imageData, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = Number(config.gradient_opacity ?? 0.55);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tempCanvas, 0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  _drawMarkers(points, config) {
    this.shadowRoot.querySelectorAll(".marker").forEach((el) => el.remove());

    if (config.show_markers === false) {
      return;
    }

    for (const point of points) {
      const marker = document.createElement("div");
      marker.className = "marker";
      marker.style.left = `${point.x}%`;
      marker.style.top = `${point.y}%`;
      marker.textContent = `${point.name}: ${point.valueText}`;
      this._elements.wrap.appendChild(marker);
    }
  }

  _colorFromScale(t, scheme) {
    const lerp = (a, b, value) => Math.round(a + (b - a) * value);

    if (scheme === "green_red") {
      return [lerp(34, 220, t), lerp(197, 53, t), lerp(94, 69, t)];
    }
    if (scheme === "viridis") {
      return [lerp(68, 253, t), lerp(1, 231, t), lerp(84, 37, t)];
    }
    if (scheme === "plasma") {
      return [lerp(13, 240, t), lerp(8, 249, t), lerp(135, 33, t)];
    }

    return [lerp(35, 230, t), lerp(105, 60, t), lerp(225, 55, t)];
  }
}

class MetricMapCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      type: "custom:metric-map-card",
      points: [],
      gradient_opacity: 0.55,
      color_scheme: "blue_red",
      show_markers: true,
      ...config,
    };
    this._mode = this._config.entry_id ? "entry" : "manual";
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._loadEntries();
    this._render();
  }

  async _loadEntries() {
    if (!this._hass || this._entriesLoaded) {
      return;
    }
    this._entriesLoaded = true;
    try {
      this._entries = await this._hass.callWS({ type: "metric_map/list" });
    } catch (_error) {
      this._entries = [];
    }
    this._render();
  }

  _render() {
    if (!this._hass || !this._config) {
      return;
    }

    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }

    const sensorIds = Object.keys(this._hass.states)
      .filter((entityId) => entityId.startsWith("sensor."))
      .sort();

    const entries = this._entries || [];

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .editor {
          display: grid;
          gap: 12px;
        }
        .hint {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.4;
        }
        .row {
          display: grid;
          grid-template-columns: 1fr 110px 110px 1fr auto;
          gap: 8px;
          align-items: center;
        }
        .points {
          display: grid;
          gap: 8px;
        }
        .section-title {
          font-weight: 600;
        }
        .mode {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        select,
        input,
        button {
          font: inherit;
        }
        button {
          cursor: pointer;
          padding: 8px 10px;
        }
      </style>
      <div class="editor">
        <div class="mode">
          <span>Режим:</span>
          <select id="mode">
            <option value="entry" ${this._mode === "entry" ? "selected" : ""}>Использовать интеграцию</option>
            <option value="manual" ${this._mode === "manual" ? "selected" : ""}>Настроить в карточке</option>
          </select>
        </div>

        <div id="base-form"></div>

        <div id="points-block" ${this._mode !== "manual" ? "hidden" : ""}>
          <div class="section-title">Объекты на карте</div>
          <div class="hint">Добавьте датчики и координаты X/Y в процентах (0..100).</div>
          <div class="points" id="points"></div>
          <button id="add-point" type="button">Добавить объект</button>
        </div>

        <div class="hint" ${this._mode !== "entry" ? "hidden" : ""}>
          В этом режиме карточка берет изображение и точки из настроек интеграции Metric Map.
        </div>
      </div>
    `;

    const modeSelect = this.shadowRoot.getElementById("mode");
    modeSelect.addEventListener("change", (event) => {
      this._mode = event.target.value;
      if (this._mode === "entry") {
        const next = { ...this._config };
        delete next.image_path;
        delete next.points;
        delete next.unit;
        delete next.min_value;
        delete next.max_value;
        delete next.gradient_opacity;
        delete next.color_scheme;
        delete next.show_markers;
        this._config = next;
      } else {
        const next = { ...this._config };
        delete next.entry_id;
        this._config = {
          ...next,
          points: Array.isArray(next.points) ? next.points : [],
          gradient_opacity: Number.isFinite(Number(next.gradient_opacity))
            ? Number(next.gradient_opacity)
            : 0.55,
          color_scheme: next.color_scheme || "blue_red",
          show_markers: next.show_markers !== false,
        };
      }
      this._notify();
      this._render();
    });

    const baseForm = this.shadowRoot.getElementById("base-form");
    const form = document.createElement("ha-form");
    form.hass = this._hass;

    if (this._mode === "entry") {
      form.schema = [
        {
          name: "entry_id",
          required: true,
          selector: {
            select: {
              mode: "dropdown",
              options: entries.map((entry) => ({ value: entry.entry_id, label: entry.title })),
            },
          },
        },
      ];
      form.data = { entry_id: this._config.entry_id || entries[0]?.entry_id || "" };
    } else {
      form.schema = [
        {
          name: "image_path",
          required: true,
          selector: { image: {} },
        },
        { name: "unit", selector: { text: {} } },
        { name: "min_value", selector: { number: { mode: "box" } } },
        { name: "max_value", selector: { number: { mode: "box" } } },
        {
          name: "gradient_opacity",
          selector: {
            number: {
              min: 0,
              max: 1,
              step: 0.05,
              mode: "slider",
            },
          },
        },
        {
          name: "color_scheme",
          selector: {
            select: {
              mode: "dropdown",
              options: ["blue_red", "green_red", "viridis", "plasma"],
            },
          },
        },
        { name: "show_markers", selector: { boolean: {} } },
      ];
      form.data = {
        image_path: this._config.image_path || "",
        unit: this._config.unit || "",
        min_value: this._config.min_value,
        max_value: this._config.max_value,
        gradient_opacity:
          Number.isFinite(Number(this._config.gradient_opacity)) && this._config.gradient_opacity !== ""
            ? Number(this._config.gradient_opacity)
            : 0.55,
        color_scheme: this._config.color_scheme || "blue_red",
        show_markers: this._config.show_markers !== false,
      };
    }

    form.addEventListener("value-changed", (event) => {
      const next = { ...this._config, ...event.detail.value };
      if (this._mode === "manual" && !Array.isArray(next.points)) {
        next.points = [];
      }
      this._config = next;
      this._notify();
      if (this._mode === "entry" && !this._config.entry_id && entries[0]?.entry_id) {
        this._config.entry_id = entries[0].entry_id;
        this._notify();
      }
    });

    baseForm.appendChild(form);

    if (this._mode === "entry" && !this._config.entry_id && entries[0]?.entry_id) {
      this._config.entry_id = entries[0].entry_id;
      this._notify();
    }

    const pointsWrap = this.shadowRoot.getElementById("points");
    if (this._mode === "manual") {
      const points = Array.isArray(this._config.points) ? this._config.points : [];
      points.forEach((point, index) => {
        const row = document.createElement("div");
        row.className = "row";
        row.innerHTML = `
          <select data-field="entity_id">
            ${sensorIds
              .map(
                (entityId) =>
                  `<option value="${entityId}" ${entityId === point.entity_id ? "selected" : ""}>${entityId}</option>`
              )
              .join("")}
          </select>
          <input data-field="x" type="number" min="0" max="100" step="0.1" value="${Number(point.x ?? 0)}" />
          <input data-field="y" type="number" min="0" max="100" step="0.1" value="${Number(point.y ?? 0)}" />
          <input data-field="label" type="text" value="${point.label || ""}" placeholder="Label" />
          <button data-remove="${index}" type="button">Удалить</button>
        `;

        row.querySelectorAll("select,input").forEach((field) => {
          field.addEventListener("change", (event) => {
            const key = event.target.dataset.field;
            const nextPoints = [...points];
            const current = { ...nextPoints[index] };
            if (key === "x" || key === "y") {
              current[key] = Number(event.target.value);
            } else {
              current[key] = event.target.value;
            }
            nextPoints[index] = current;
            this._config = { ...this._config, points: nextPoints };
            this._notify();
          });
        });

        row.querySelector("button").addEventListener("click", () => {
          const nextPoints = points.filter((_item, pointIndex) => pointIndex !== index);
          this._config = { ...this._config, points: nextPoints };
          this._notify();
          this._render();
        });

        pointsWrap.appendChild(row);
      });

      this.shadowRoot.getElementById("add-point").addEventListener("click", () => {
        const defaultEntity = sensorIds[0] || "";
        const nextPoints = [
          ...points,
          {
            entity_id: defaultEntity,
            x: 50,
            y: 50,
            label: "",
          },
        ];
        this._config = { ...this._config, points: nextPoints };
        this._notify();
        this._render();
      });
    }
  }

  _notify() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define("metric-map-card", MetricMapCard);
customElements.define("metric-map-card-editor", MetricMapCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "metric-map-card",
  name: "Metric Map Card",
  description: "Display a heatmap from configured sensors on top of a floor map",
});
