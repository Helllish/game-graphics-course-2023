import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import {mat4, vec3, vec4, quat} from "../node_modules/gl-matrix/esm/index.js";

import {positions, normals, indices} from "../blender/op.js";
import {positions as planePositions, indices as planeIndices} from "../blender/plane.js";

let fragmentShader = `
    #version 300 es    
    precision highp float;    
    precision highp sampler2DShadow;

    uniform vec4 baseColor;
    uniform vec4 ambientColor;
    uniform vec3 lightPosition;
    uniform vec3 cameraPosition;    
    uniform sampler2DShadow shadowMap;

    uniform float metalness;

    in vec3 vPosition;
    in vec3 vNormal;
    in vec4 vPositionFromLight;
    in vec3 vModelPosition;
    out vec4 fragColor;

    const int numSamples = 99;

void main() {
    vec3 normal = normalize(vNormal);
    float bias = 0.005;
    
    float shadowSum = 0.0;
    for (int i = 0; i < numSamples; ++i) {
        vec2 offset = vec2(cos(float(i) * 2.0 * 3.14159 / float(numSamples)), 
                           sin(float(i) * 2.0 * 3.14159 / float(numSamples)));
        vec3 shadowCoord = (vPositionFromLight.xyz + normal * bias + vec3(offset.xy, 0.0)) / vPositionFromLight.w / 2.0 + 0.5;
        shadowSum += texture(shadowMap, shadowCoord);
    }
    
    float shadow = shadowSum / float(numSamples);
    
    vec3 eyeDirection = normalize(cameraPosition - vPosition);
    vec3 lightDirection = normalize(lightPosition - vPosition);        
    vec3 reflectionDirection = reflect(-lightDirection, normal);
    
    float diffuse = max(dot(lightDirection, normal), 0.0) * max(shadow, 0.2);        

    float metallicReflection = mix(10.0, 10.0, metalness);
    
    float specular = shadow * pow(max(dot(reflectionDirection, eyeDirection), 0.0), 100.0) * metallicReflection;
    
    fragColor = vec4(diffuse * baseColor.rgb + ambientColor.rgb + specular, baseColor.a);
}
`;

let vertexShader = `
    #version 300 es
    
    layout(location=0) in vec4 position;
    layout(location=1) in vec3 normal;
    
    uniform mat4 modelMatrix;
    uniform mat4 modelViewProjectionMatrix;
    uniform mat4 lightModelViewProjectionMatrix;
    
    out vec3 vPosition;
    out vec3 vNormal;
    out vec4 vPositionFromLight;
    out vec3 vModelPosition;
    
    void main() {
        gl_Position = modelViewProjectionMatrix * position;
        vModelPosition = vec3(position);
        vPosition = vec3(modelMatrix * position);
        vNormal = vec3(modelMatrix * vec4(normal, 0.0));
        vPositionFromLight = lightModelViewProjectionMatrix * position;
    }
`;

let shadowFragmentShader = `
    #version 300 es
    precision highp float;
    
    out vec4 fragColor;
    
    void main() {   
        fragColor = vec4((gl_FragCoord.z - 0.98) * 50.0);    
    }
`;

let shadowVertexShader = `
    #version 300 es
    layout(location=0) in vec4 position;
    uniform mat4 lightModelViewProjectionMatrix;
    
    void main() {
        gl_Position = lightModelViewProjectionMatrix * position;
    }
`;

let bgColor = vec4.fromValues(0, 0, 0, 0);
let color1 = vec4.fromValues(0.380, 0.424, 0.545, 1.0);
let color2 = vec4.fromValues(0.380, 0.510, 0.545, 1.0);
let color3 = vec4.fromValues(0.439, 0.380, 0.545, 1.0); 

app.enable(PicoGL.DEPTH_TEST)
   .enable(PicoGL.CULL_FACE)
   .clearColor(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);

let program = app.createProgram(vertexShader, fragmentShader);
let shadowProgram = app.createProgram(shadowVertexShader, shadowFragmentShader);

let vertexArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, positions))
    .vertexAttributeBuffer(1, app.createVertexBuffer(PicoGL.FLOAT, 3, normals))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, indices));

let shadowDepthTarget = app.createTexture2D(1024, 1024, {
    internalFormat: PicoGL.DEPTH_COMPONENT16,
    compareMode: PicoGL.COMPARE_REF_TO_TEXTURE,
    magFilter: PicoGL.LINEAR,
    minFilter: PicoGL.LINEAR,
    wrapS: PicoGL.CLAMP_TO_EDGE,
    wrapT: PicoGL.CLAMP_TO_EDGE
});
let shadowBuffer = app.createFramebuffer().depthTarget(shadowDepthTarget);

let time = 0;
let projMatrix = mat4.create();
let viewMatrix = mat4.create();
let viewProjMatrix = mat4.create();
let modelMatrix = mat4.create();
let modelViewProjectionMatrix = mat4.create();
let rotation = quat.create();
let lightModelViewProjectionMatrix = mat4.create();

let cameraPosition = vec3.create();
let lightPosition = vec3.create();
let lightViewMatrix = mat4.create();
let lightViewProjMatrix = mat4.create();

let drawCall1 = app.createDrawCall(program, vertexArray)
    .uniform("baseColor", color1)
    .uniform("ambientColor", vec4.scale(vec4.create(), bgColor, 0.7))
    .uniform("modelMatrix", modelMatrix)
    .uniform("modelViewProjectionMatrix", modelViewProjectionMatrix)
    .uniform("cameraPosition", cameraPosition)
    .uniform("lightPosition", lightPosition)
    .uniform("lightModelViewProjectionMatrix", lightModelViewProjectionMatrix)
    .texture("shadowMap", shadowDepthTarget);

let drawCall2 = app.createDrawCall(program, vertexArray)
    .uniform("baseColor", color2)
    .uniform("ambientColor", vec4.scale(vec4.create(), bgColor, 0.7))
    .uniform("modelMatrix", modelMatrix)
    .uniform("modelViewProjectionMatrix", modelViewProjectionMatrix)
    .uniform("cameraPosition", cameraPosition)
    .uniform("lightPosition", lightPosition)
    .uniform("lightModelViewProjectionMatrix", lightModelViewProjectionMatrix)
    .texture("shadowMap", shadowDepthTarget);

let drawCall3 = app.createDrawCall(program, vertexArray)
    .uniform("baseColor", color3)
    .uniform("ambientColor", vec4.scale(vec4.create(), bgColor, 0.7))
    .uniform("modelMatrix", modelMatrix)
    .uniform("modelViewProjectionMatrix", modelViewProjectionMatrix)
    .uniform("cameraPosition", cameraPosition)
    .uniform("lightPosition", lightPosition)
    .uniform("lightModelViewProjectionMatrix", lightModelViewProjectionMatrix)
    .texture("shadowMap", shadowDepthTarget);

let shadowDrawCall = app.createDrawCall(shadowProgram, vertexArray)
    .uniform("lightModelViewProjectionMatrix", lightModelViewProjectionMatrix);

function renderShadowMap() {
    app.drawFramebuffer(shadowBuffer);
    app.viewport(0, 0, shadowDepthTarget.width, shadowDepthTarget.height);
    app.gl.cullFace(app.gl.FRONT);

    mat4.perspective(projMatrix, Math.PI * 0.02, shadowDepthTarget.width / shadowDepthTarget.height, 0.1, 99.0);
    mat4.multiply(lightViewProjMatrix, projMatrix, lightViewMatrix);

    drawObjects(shadowDrawCall);

    app.gl.cullFace(app.gl.BACK);
    app.defaultDrawFramebuffer();
    app.defaultViewport();
}

function drawObjects() {
    app.clear();

    //mid
    quat.fromEuler(rotation, time * 48, time * 56, 0);
    mat4.fromRotationTranslationScale(modelMatrix, rotation, vec3.fromValues(0, 0, 0), [1, 1, 1]);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);
    mat4.multiply(lightModelViewProjectionMatrix, lightViewProjMatrix, modelMatrix);
    drawCall1.draw();
    
    //lar
    quat.fromEuler(rotation, time * 24, time * 28, 0);
    mat4.fromRotationTranslationScale(modelMatrix, rotation, vec3.fromValues(0, 0, 0), [2.5, 2.5, 2.5]);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);
    mat4.multiply(lightModelViewProjectionMatrix, lightViewProjMatrix, modelMatrix);
    drawCall2.draw();

    //smal
    quat.fromEuler(rotation, time * 30, time * 34, 0);
    mat4.fromRotationTranslationScale(modelMatrix, rotation, vec3.fromValues(0, 0, 0), [0.22, 0.22, 0.22]);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);
    mat4.multiply(lightModelViewProjectionMatrix, lightViewProjMatrix, modelMatrix);
    drawCall3.draw();
}


function draw(timems) {
    time = timems * 0.001;

    vec3.set(cameraPosition, 0, 10, 4);
    mat4.perspective(projMatrix, Math.PI / 2.5, app.width / app.height, 0.1, 100.0);
    mat4.lookAt(viewMatrix, cameraPosition, vec3.fromValues(0, -0.5, 0), vec3.fromValues(0, 1, 0));
    mat4.multiply(viewProjMatrix, projMatrix, viewMatrix);

    vec3.set(lightPosition, 5, 5, 2.5);
    mat4.lookAt(lightViewMatrix, lightPosition, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));

    renderShadowMap();
    drawObjects();

    requestAnimationFrame(draw);
}
requestAnimationFrame(draw)