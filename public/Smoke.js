"use strict";

function getMousePos(canvas, evt) {
  var rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top,
  };
}

var canvas = document.getElementsByTagName("canvas")[0];
canvas.addEventListener("mousemove", function (evt) {
  var mousePos = getMousePos(canvas, evt);
  var message = "Mouse position: " + mousePos.x + "," + mousePos.y;
  document.getElementsByTagName("h2")[0].innerText = message;
});

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

var config = {
  TEXTURE_DOWNSAMPLE: 1,
  DENSITY_DISSIPATION: 0.98,
  VELOCITY_DISSIPATION: 0.99,
  PRESSURE_DISSIPATION: 0.8,
  PRESSURE_ITERATIONS: 25,
  CURL: 30,
  SPLAT_RADIUS: 0.005,
};

var pointers = [];
var splatStack = [];

var _getWebGLContext = getWebGLContext(canvas);
var gl = _getWebGLContext.gl;
var ext = _getWebGLContext.ext;
var support_linear_float = _getWebGLContext.support_linear_float;

function getWebGLContext(canvas) {
  var params = {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
  };

  var gl = canvas.getContext("webgl2", params);

  var isWebGL2 = !!gl;

  if (!isWebGL2)
    gl =
      canvas.getContext("webgl", params) ||
      canvas.getContext("experimental-webgl", params);

  var halfFloat = gl.getExtension("OES_texture_half_float");
  var support_linear_float = gl.getExtension("OES_texture_half_float_linear");

  if (isWebGL2) {
    gl.getExtension("EXT_color_buffer_float");
    support_linear_float = gl.getExtension("OES_texture_float_linear");
  }

  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  var internalFormat = isWebGL2 ? gl.RGBA16F : gl.RGBA;
  var internalFormatRG = isWebGL2 ? gl.RG16F : gl.RGBA;
  var formatRG = isWebGL2 ? gl.RG : gl.RGBA;
  var texType = isWebGL2 ? gl.HALF_FLOAT : halfFloat.HALF_FLOAT_OES;

  return {
    gl: gl,
    ext: {
      internalFormat: internalFormat,
      internalFormatRG: internalFormatRG,
      formatRG: formatRG,
      texType: texType,
    },
    support_linear_float: support_linear_float,
  };
}

function pointerPrototype() {
  this.id = -1;
  this.x = 0;
  this.y = 0;
  this.dx = 0;
  this.dy = 0;
  this.down = false;
  this.moved = false;
  this.color = [30, 0, 300];
}

pointers.push(new pointerPrototype());

var GLProgram = (function () {
  function GLProgram(vertexShader, fragmentShader) {
    if (!(this instanceof GLProgram))
      throw new TypeError("Cannot call a class as a function");

    this.uniforms = {};
    this.program = gl.createProgram();

    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      throw gl.getProgramInfoLog(this.program);

    var uniformCount = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);

    for (var i = 0; i < uniformCount; i++) {
      var uniformName = gl.getActiveUniform(this.program, i).name;

      this.uniforms[uniformName] = gl.getUniformLocation(
        this.program,
        uniformName
      );
    }
  }

  GLProgram.prototype.bind = function bind() {
    gl.useProgram(this.program);
  };

  return GLProgram;
})();

function compileShader(type, source) {
  var shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw gl.getShaderInfoLog(shader);

  return shader;
}

var baseVertexShader = compileShader(
  gl.VERTEX_SHADER,
  "precision highp float; precision mediump sampler2D; attribute vec2 aPosition; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform vec2 texelSize; void main () {     vUv = aPosition * 0.5 + 0.5;     vL = vUv - vec2(texelSize.x, 0.0);     vR = vUv + vec2(texelSize.x, 0.0);     vT = vUv + vec2(0.0, texelSize.y);     vB = vUv - vec2(0.0, texelSize.y);     gl_Position = vec4(aPosition, 0.0, 1.0); }"
);
var clearShader = compileShader(
  gl.FRAGMENT_SHADER,
  "precision highp float; precision mediump sampler2D; varying vec2 vUv; uniform sampler2D uTexture; uniform float value; void main () {     gl_FragColor = value * texture2D(uTexture, vUv); }"
);
var displayShader = compileShader(
  gl.FRAGMENT_SHADER,
  "precision highp float; precision mediump sampler2D; varying vec2 vUv; uniform sampler2D uTexture; void main () {     gl_FragColor = texture2D(uTexture, vUv); }"
);
var splatShader = compileShader(
  gl.FRAGMENT_SHADER,
  "precision highp float; precision mediump sampler2D; varying vec2 vUv; uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius; void main () {     vec2 p = vUv - point.xy;     p.x *= aspectRatio;     vec3 splat = exp(-dot(p, p) / radius) * color;     vec3 base = texture2D(uTarget, vUv).xyz;     gl_FragColor = vec4(base + splat, 1.0); }"
);
var advectionManualFilteringShader = compileShader(
  gl.FRAGMENT_SHADER,
  "precision highp float; precision mediump sampler2D; varying vec2 vUv; uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 texelSize; uniform float dt; uniform float dissipation; vec4 bilerp (in sampler2D sam, in vec2 p) {     vec4 st;     st.xy = floor(p - 0.5) + 0.5;     st.zw = st.xy + 1.0;     vec4 uv = st * texelSize.xyxy;     vec4 a = texture2D(sam, uv.xy);     vec4 b = texture2D(sam, uv.zy);     vec4 c = texture2D(sam, uv.xw);     vec4 d = texture2D(sam, uv.zw);     vec2 f = p - st.xy;     return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); } void main () {     vec2 coord = gl_FragCoord.xy - dt * texture2D(uVelocity, vUv).xy;     gl_FragColor = dissipation * bilerp(uSource, coord);     gl_FragColor.a = 1.0; }"
);
var advectionShader = compileShader(
  gl.FRAGMENT_SHADER,
  "precision highp float; precision mediump sampler2D; varying vec2 vUv; uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 texelSize; uniform float dt; uniform float dissipation; void main () {     vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;     gl_FragColor = dissipation * texture2D(uSource, coord); }"
);
var divergenceShader = compileShader(
  gl.FRAGMENT_SHADER,
  "precision highp float; precision mediump sampler2D; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform sampler2D uVelocity; vec2 sampleVelocity (in vec2 uv) {     vec2 multiplier = vec2(1.0, 1.0);     if (uv.x < 0.0) { uv.x = 0.0; multiplier.x = -1.0; }     if (uv.x > 1.0) { uv.x = 1.0; multiplier.x = -1.0; }     if (uv.y < 0.0) { uv.y = 0.0; multiplier.y = -1.0; }     if (uv.y > 1.0) { uv.y = 1.0; multiplier.y = -1.0; }     return multiplier * texture2D(uVelocity, uv).xy; } void main () {     float L = sampleVelocity(vL).x;     float R = sampleVelocity(vR).x;     float T = sampleVelocity(vT).y;     float B = sampleVelocity(vB).y;     vec2 C = texture2D(uVelocity, vUv).xy;     if (vL.x < 0.0) L = -C.x;     if (vR.x > 1.0) R = -C.x;     if (vB.y < 0.0) B = -C.y;     if (vT.y > 1.0) T = -C.y;     float div = 0.5 * (R - L + T - B);     gl_FragColor = vec4(div, 0.0, 0.0, 1.0); }"
);
var curlShader = compileShader(
  gl.FRAGMENT_SHADER,
  "precision highp float; precision mediump sampler2D; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform sampler2D uVelocity; void main () {     float L = texture2D(uVelocity, vL).y;     float R = texture2D(uVelocity, vR).y;     float T = texture2D(uVelocity, vT).x;     float B = texture2D(uVelocity, vB).x;     float vorticity = R - L - T + B;     gl_FragColor = vec4(vorticity, 0.0, 0.0, 1.0); }"
);
var vorticityShader = compileShader(
  gl.FRAGMENT_SHADER,
  "precision highp float; precision mediump sampler2D; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt; void main () {     float L = texture2D(uCurl, vL).x;     float R = texture2D(uCurl, vR).x;     float T = texture2D(uCurl, vT).x;     float B = texture2D(uCurl, vB).x;     float C = texture2D(uCurl, vUv).x;     vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));     force /= length(force) + 0.0001;     force *= curl * C;     vec2 vel = texture2D(uVelocity, vUv).xy;     gl_FragColor = vec4(vel + force * dt, 0.0, 1.0); }"
);
var pressureShader = compileShader(
  gl.FRAGMENT_SHADER,
  "precision highp float; precision mediump sampler2D; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform sampler2D uPressure; uniform sampler2D uDivergence; void main () {     float L = texture2D(uPressure, vL).x;     float R = texture2D(uPressure, vR).x;     float T = texture2D(uPressure, vT).x;     float B = texture2D(uPressure, vB).x;     float C = texture2D(uPressure, vUv).x;     float divergence = texture2D(uDivergence, vUv).x;     float pressure = (L + R + B + T - divergence) * 0.25;     gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0); }"
);
var gradientSubtractShader = compileShader(
  gl.FRAGMENT_SHADER,
  "precision highp float; precision mediump sampler2D; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform sampler2D uPressure; uniform sampler2D uVelocity; void main () {     float L = texture2D(uPressure, vL).x;     float R = texture2D(uPressure, vR).x;     float T = texture2D(uPressure, vT).x;     float B = texture2D(uPressure, vB).x;     vec2 velocity = texture2D(uVelocity, vUv).xy;     velocity.xy -= vec2(R - L, T - B);     gl_FragColor = vec4(velocity, 0.0, 1.0); }"
);

var clearProgram = new GLProgram(baseVertexShader, clearShader);
var displayProgram = new GLProgram(baseVertexShader, displayShader);
var splatProgram = new GLProgram(baseVertexShader, splatShader);
var advectionProgram = new GLProgram(
  baseVertexShader,
  support_linear_float ? advectionShader : advectionManualFilteringShader
);
var divergenceProgram = new GLProgram(baseVertexShader, divergenceShader);
var curlProgram = new GLProgram(baseVertexShader, curlShader);
var vorticityProgram = new GLProgram(baseVertexShader, vorticityShader);
var pressureProgram = new GLProgram(baseVertexShader, pressureShader);
var gradienSubtractProgram = new GLProgram(
  baseVertexShader,
  gradientSubtractShader
);

function createFBO(texId, w, h, internalFormat, format, type, param) {
  gl.activeTexture(gl.TEXTURE0 + texId);

  var texture = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

  var fbo = gl.createFramebuffer();

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );
  gl.viewport(0, 0, w, h);
  gl.clear(gl.COLOR_BUFFER_BIT);

  return [texture, fbo, texId];
}

function createDoubleFBO(texId, w, h, internalFormat, format, type, param) {
  var fbo1 = createFBO(texId, w, h, internalFormat, format, type, param);
  var fbo2 = createFBO(texId + 1, w, h, internalFormat, format, type, param);

  return {
    get read() {
      return fbo1;
    },
    get write() {
      return fbo2;
    },
    swap: function swap() {
      var temp = fbo1;

      fbo1 = fbo2;
      fbo2 = temp;
    },
  };
}

var textureWidth = void 0;
var textureHeight = void 0;
var density = void 0;
var velocity = void 0;
var divergence = void 0;
var curl = void 0;
var pressure = void 0;

initFramebuffers();

var quad = gl.createBuffer();

gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
  gl.STATIC_DRAW
);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

var lastTime = Date.now();
update();

function update() {
  resizeCanvas();

  var dt = Math.min((Date.now() - lastTime) / 1000, 0.016);

  lastTime = Date.now();

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  var aspectRatio = canvas.width / canvas.height;
  var radius = config.SPLAT_RADIUS / 100.0;

  for (var i = 0; i < pointers.length; i++) {
    var pointer = pointers[i];

    if (pointer.moved) {
      splat(pointer.x, pointer.y, pointer.dx, pointer.dy, pointer.color);
      pointer.moved = false;
    }
  }

  if (splatStack.length > 0) {
    var _splatStack$pop = splatStack.pop(),
      x = _splatStack$pop.x,
      y = _splatStack$pop.y,
      dx = _splatStack$pop.dx,
      dy = _splatStack$pop.dy,
      color = _splatStack$pop.color;

    splat(x, y, dx, dy, color);
  }

  advectionProgram.bind();
  gl.uniform2f(
    advectionProgram.uniforms.texelSize,
    1.0 / textureWidth,
    1.0 / textureHeight
  );
  gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read[2]);
  gl.uniform1i(advectionProgram.uniforms.uSource, velocity.read[2]);
  gl.uniform1f(advectionProgram.uniforms.dt, dt);
  gl.uniform1f(
    advectionProgram.uniforms.dissipation,
    config.VELOCITY_DISSIPATION
  );
  blit(velocity.write[1]);
  velocity.swap();

  gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read[2]);
  gl.uniform1i(advectionProgram.uniforms.uSource, density.read[2]);
  gl.uniform1f(
    advectionProgram.uniforms.dissipation,
    config.DENSITY_DISSIPATION
  );
  blit(density.write[1]);
  density.swap();

  curlProgram.bind();
  gl.uniform2f(
    curlProgram.uniforms.texelSize,
    1.0 / textureWidth,
    1.0 / textureHeight
  );
  gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read[2]);
  blit(curl[1]);

  vorticityProgram.bind();
  gl.uniform2f(
    vorticityProgram.uniforms.texelSize,
    1.0 / textureWidth,
    1.0 / textureHeight
  );
  gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read[2]);
  gl.uniform1i(vorticityProgram.uniforms.uCurl, curl[2]);
  gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
  gl.uniform1f(vorticityProgram.uniforms.dt, dt);
  blit(velocity.write[1]);
  velocity.swap();

  divergenceProgram.bind();
  gl.uniform2f(
    divergenceProgram.uniforms.texelSize,
    1.0 / textureWidth,
    1.0 / textureHeight
  );
  gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read[2]);
  blit(divergence[1]);

  clearProgram.bind();
  gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read[2]);
  gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE_DISSIPATION);
  blit(pressure.write[1]);
  pressure.swap();

  pressureProgram.bind();
  gl.uniform2f(
    pressureProgram.uniforms.texelSize,
    1.0 / textureWidth,
    1.0 / textureHeight
  );
  gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence[2]);

  for (var _i = 0; _i < config.PRESSURE_ITERATIONS; _i++) {
    gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read[2]);
    blit(pressure.write[1]);
    pressure.swap();
  }

  gradienSubtractProgram.bind();
  gl.uniform2f(
    gradienSubtractProgram.uniforms.texelSize,
    1.0 / textureWidth,
    1.0 / textureHeight
  );
  gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read[2]);
  gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read[2]);
  blit(velocity.write[1]);
  velocity.swap();

  displayProgram.bind();
  gl.uniform1i(displayProgram.uniforms.uTexture, density.read[2]);
  blit(null);

  requestAnimationFrame(update);
}

function splat(x, y, dx, dy, color) {
  splatProgram.bind();
  gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read[2]);
  gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
  gl.uniform2f(
    splatProgram.uniforms.point,
    x / canvas.width,
    1.0 - y / canvas.height
  );
  gl.uniform3f(splatProgram.uniforms.color, dx, -dy, 1.0);
  gl.uniform1f(splatProgram.uniforms.radius, config.SPLAT_RADIUS);
  blit(velocity.write[1]);
  velocity.swap();

  gl.uniform1i(splatProgram.uniforms.uTarget, density.read[2]);
  gl.uniform3f(splatProgram.uniforms.color, color[0], color[1], color[2]);
  blit(density.write[1]);
  density.swap();
}

function resizeCanvas() {
  if (
    canvas.width != canvas.clientWidth ||
    canvas.height != canvas.clientHeight
  ) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    initFramebuffers();
  }
}

function initFramebuffers() {
  var simWidth = canvas.width >> config.TEXTURE_DOWNSAMPLE;
  var simHeight = canvas.height >> config.TEXTURE_DOWNSAMPLE;

  var texType = ext.texType;
  var rgba = ext.internalFormat;
  var rg = ext.internalFormatRG;
  var r = gl.RED;
  var filtering = support_linear_float ? gl.LINEAR : gl.NEAREST;

  gl.disable(gl.BLEND);

  textureWidth = simWidth;
  textureHeight = simHeight;

  density = createDoubleFBO(
    0,
    simWidth,
    simHeight,
    rgba,
    gl.RGBA,
    texType,
    filtering
  );
  velocity = createDoubleFBO(
    2,
    simWidth,
    simHeight,
    rg,
    ext.formatRG,
    texType,
    filtering
  );
  divergence = createFBO(
    4,
    simWidth,
    simHeight,
    r,
    gl.RED,
    texType,
    gl.NEAREST
  );
  curl = createFBO(5, simWidth, simHeight, r, gl.RED, texType, gl.NEAREST);
  pressure = createDoubleFBO(
    6,
    simWidth,
    simHeight,
    r,
    gl.RED,
    texType,
    gl.NEAREST
  );
}

function blit(destination) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

canvas.addEventListener("mousedown", function (e) {
  var posX = scaleByPixelRatio(e.offsetX);
  var posY = scaleByPixelRatio(e.offsetY);
  var pointer = pointers.find(function (p) {
    return p.id == -1;
  });

  if (pointer == null) pointer = new pointerPrototype();

  updatePointerDownData(pointer, -1, posX, posY);
});

canvas.addEventListener("mousemove", function (e) {
  var pointer = pointers[0];
  if (!pointer.down) return;
  var posX = scaleByPixelRatio(e.offsetX);
  var posY = scaleByPixelRatio(e.offsetY);
  updatePointerMoveData(pointer, posX, posY);
});

window.addEventListener("mouseup", function () {
  updatePointerUpData(pointers[0]);
});

canvas.addEventListener("touchstart", function (e) {
  e.preventDefault();
  var touches = e.targetTouches;
  while (touches.length >= pointers.length)
    pointers.push(new pointerPrototype());

  for (var i = 0; i < touches.length; i++) {
    var posX = scaleByPixelRatio(touches[i].pageX);
    var posY = scaleByPixelRatio(touches[i].pageY);
    updatePointerDownData(pointers[i + 1], touches[i].identifier, posX, posY);
  }
});

canvas.addEventListener(
  "touchmove",
  function (e) {
    e.preventDefault();
    var touches = e.targetTouches;
    for (var i = 0; i < touches.length; i++) {
      var pointer = pointers[i + 1];
      if (!pointer.down) continue;
      var posX = scaleByPixelRatio(touches[i].pageX);
      var posY = scaleByPixelRatio(touches[i].pageY);
      updatePointerMoveData(pointer, posX, posY);
    }
  },
  false
);

window.addEventListener("touchend", function (e) {
  var touches = e.changedTouches;
  for (var i = 0; i < touches.length; i++) {
    var pointer = pointers.find(function (p) {
      return p.id == touches[i].identifier;
    });
    updatePointerUpData(pointer);
  }
});

window.addEventListener("keydown", function (e) {
  if (e.code === "KeyP") {
    splatStack.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      dx: 1000 * (Math.random() - 0.5),
      dy: 1000 * (Math.random() - 0.5),
      color: [Math.random() * 10, Math.random() * 10, Math.random() * 10],
    });
  }
});

function updatePointerDownData(pointer, id, posX, posY) {
  pointer.id = id;
  pointer.down = true;
  pointer.moved = false;
  pointer.x = posX;
  pointer.y = posY;
  pointer.color = [30, 0, 300];
}

function updatePointerMoveData(pointer, posX, posY) {
  pointer.moved = pointer.down;
  pointer.dx = posX - pointer.x;
  pointer.dy = posY - pointer.y;
  pointer.x = posX;
  pointer.y = posY;
}

function updatePointerUpData(pointer) {
  pointer.down = false;
}

function scaleByPixelRatio(input) {
  var pixelRatio = window.devicePixelRatio || 1;
  return Math.floor(input * pixelRatio);
}
