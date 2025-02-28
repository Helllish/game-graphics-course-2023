// *********************************************************************************************************************
// **                                                                                                                 **
// **             Texturing example, Cube is mapped with 2D texture, skybox is mapped with a Cubemap                  **
// **                                                                                                                 **
// *********************************************************************************************************************

import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import {mat4, vec3} from "../node_modules/gl-matrix/esm/index.js";

import {positions, uvs, indices} from "../blender/cube.js";
import {positions as planePositions, indices as planeIndices} from "../blender/plane.js";

// language=GLSL
let fragmentShader = `
    #version 300 es
    precision highp float;
    
    uniform sampler2D tex1;
    uniform sampler2D tex2;    
    
    in vec2 v_uv;
    
    out vec4 outColor;
    
    void main()
    {        
        vec2 uv = v_uv * 3.0; // Scale UV coordinates to cover [0, 3] range
        int face = int(floor(uv.y)) * 3 + int(floor(uv.x));
        
        vec2 adjustedUV = vec2(fract(uv.x), fract(uv.y));
        
        vec4 color;
        if (face == 0 || face == 2 || face == 6 || face == 8) {
            color = texture(tex1, adjustedUV);
        } else {
            color = texture(tex2, adjustedUV);
        }
        
        outColor = color;
    }
`;

// language=GLSL
let vertexShader = `
    #version 300 es
            
    uniform mat4 modelViewProjectionMatrix;
    
    layout(location=0) in vec3 position;
    layout(location=1) in vec3 normal;
    layout(location=2) in vec2 uv;
        
    out vec2 v_uv;
    
    void main()
    {
        gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);           
        v_uv = uv;
    }
`;


// language=GLSL
let skyboxFragmentShader = `
    #version 300 es
    precision mediump float;
    
    uniform samplerCube cubemap;
    uniform mat4 viewProjectionInverse;
    in vec4 v_position;
    
    out vec4 outColor;
    
    void main() {
      vec4 t = viewProjectionInverse * v_position;
      outColor = texture(cubemap, normalize(t.xyz / t.w));
    }
`;

// language=GLSL
let skyboxVertexShader = `
    #version 300 es
    
    layout(location=0) in vec4 position;
    out vec4 v_position;
    
    void main() {
      v_position = vec4(position.xz, 1.0, 1.0);
      gl_Position = v_position;
    }
`;

let program = app.createProgram(vertexShader.trim(), fragmentShader.trim());
let skyboxProgram = app.createProgram(skyboxVertexShader.trim(), skyboxFragmentShader.trim());

let vertexArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, positions))
    .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, uvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, indices));

let skyboxArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, planePositions))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, planeIndices));

let projMatrix = mat4.create();
let viewMatrix = mat4.create();
let viewProjMatrix = mat4.create();
let modelMatrix = mat4.create();
let modelViewMatrix = mat4.create();
let modelViewProjectionMatrix = mat4.create();
let rotateXMatrix = mat4.create();
let rotateYMatrix = mat4.create();
let skyboxViewProjectionInverse = mat4.create();

async function loadTexture(fileName) {
    return await createImageBitmap(await (await fetch("images/" + fileName)).blob());
}

const tex1 = await loadTexture("cat.jpg");
const tex2 = await loadTexture("cat1.jpg");
let drawCall = app.createDrawCall(program, vertexArray)
    .texture("tex1", app.createTexture2D(tex1, tex1.width, tex1.height, {
        magFilter: PicoGL.LINEAR,
        minFilter: PicoGL.LINEAR_MIPMAP_LINEAR,
        maxAnisotropy: 10,
        wrapS: PicoGL.CLAMP_TO_EDGE,
        wrapT: PicoGL.CLAMP_TO_EDGE
    }))
    .texture("tex2", app.createTexture2D(tex2, tex2.width, tex2.height, {
        magFilter: PicoGL.LINEAR,
        minFilter: PicoGL.LINEAR_MIPMAP_LINEAR,
        maxAnisotropy: 10,
        wrapS: PicoGL.CLAMP_TO_EDGE,
        wrapT: PicoGL.CLAMP_TO_EDGE
    }));

let skyboxDrawCall = app.createDrawCall(skyboxProgram, skyboxArray)
    .texture("cubemap", app.createCubemap({
        negX: await loadTexture("pz.png"),
        posX: await loadTexture("nz.png"),
        negY: await loadTexture("ny.png"),
        posY: await loadTexture("py.png"),
        negZ: await loadTexture("nx.png"),
        posZ: await loadTexture("px.png")
    }));

function draw(timems) {
    const time = timems * 0.001;

    mat4.perspective(projMatrix, Math.PI / 2, app.width / app.height, 0.1, 100.0);
    let camPos = vec3.rotateY(vec3.create(), vec3.fromValues(0, 0.5, 2), vec3.fromValues(0, 0, 0), time * 0.05);
    mat4.lookAt(viewMatrix, camPos, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
    mat4.multiply(viewProjMatrix, projMatrix, viewMatrix);

    mat4.fromXRotation(rotateXMatrix, time * 0.1136);
    mat4.fromZRotation(rotateYMatrix, time * 0.2235);
    mat4.multiply(modelMatrix, rotateXMatrix, rotateYMatrix);

    mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);

    let skyboxViewProjectionMatrix = mat4.create();
    mat4.mul(skyboxViewProjectionMatrix, projMatrix, viewMatrix);
    mat4.invert(skyboxViewProjectionInverse, skyboxViewProjectionMatrix);

    app.clear();

    app.disable(PicoGL.DEPTH_TEST);
    app.disable(PicoGL.CULL_FACE);
    skyboxDrawCall.uniform("viewProjectionInverse", skyboxViewProjectionInverse);
    skyboxDrawCall.draw();

    app.enable(PicoGL.DEPTH_TEST);
    app.enable(PicoGL.CULL_FACE);
    drawCall.uniform("modelViewProjectionMatrix", modelViewProjectionMatrix);
    drawCall.draw();

    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
