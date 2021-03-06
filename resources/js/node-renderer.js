const MAX_NODE_SIZE = 8;
const MIN_NODE_SIZE = 2;

class NodeRenderer extends THREE.Group {
    constructor(colormap, count, maxAttributes = 16, maxVaryings = 8) {
        super();

        this.slices = Math.min(maxAttributes-4, 2*maxVaryings-1);
        this.instance_count = count;

        this.colormap = colormap;

        this.material = new THREE.RawShaderMaterial({
            uniforms: {
                nodeZoom: {value: 1.0},
                nodeTex: {value: this.colormap.getTexture() },
            },
            vertexShader: /*glsl*/`
                precision highp float;

                uniform mat4 modelViewMatrix;
                uniform mat4 projectionMatrix;
                uniform float nodeZoom;

                attribute vec2 position;
                attribute float scale;
                ${Array.from({ length: this.slices }, (_, i) => "attribute vec2 run" + i + ";").join('')}

                varying vec2 vPosition;
                ${Array.from({ length: this.slices }, (_, i) => "varying vec2 vRun" + i + ";").join('')}

                void main() {
                    vPosition = position;
                    ${Array.from({ length: this.slices }, (_, i) => "vRun" + i + " = run" + i + ";").join('')}

                    gl_PointSize = scale * nodeZoom;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4 (position, 0.0, 1.0);
                }`,
            fragmentShader: /*glsl*/`
            #ifdef GL_OES_standard_derivatives
                #extension GL_OES_standard_derivatives : enable
            #endif
                precision highp float;

                #define M_PI 3.14159265358979

                uniform sampler2D nodeTex;

                varying vec2 vPosition;
                ${Array.from({ length: this.slices }, (_, i) => "varying vec2 vRun" + i + ";").join('')}

                void main() {
                    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
                    float r = dot(cxy, cxy);
                    float a;

                #ifdef GL_OES_standard_derivatives
                    float d = fwidth(r);
                    a = 1.0 - smoothstep(1.0 - d, 1.0 + d, r);
                #else
                    if (r > 1.0) discard;
                    a = 1.0;
                #endif

                    float pixelPercent = 1.0 - (1.0 + atan(cxy.x, cxy.y) / M_PI) / 2.0;
                    vec2 curr;

                #ifdef GL_OES_standard_derivatives
                    vec2 prev;
                    if(pixelPercent<=vRun0.x){curr=vRun0;prev=vRun0;}else{
                    ${Array.from({ length: this.slices-2}, (_, i) => "if(pixelPercent<=vRun" + (i+1) + ".x){curr=vRun" + (i+1) + ";prev=vRun" + (i) + ";}else{").join('')}
                    ${"curr=vRun" + (this.slices-1) + ";prev=vRun" + (this.slices-1) + ";" + "}".repeat(this.slices-1)}
                    d = mod(fwidth(pixelPercent), 1.0);
                    vec3 c = mix(texture2D( nodeTex, vec2 ( prev.y , 1.0) ).xyz, texture2D( nodeTex, vec2 ( curr.y , 1.0) ).xyz, clamp((pixelPercent - prev.x) / d, 0.0, 1.0));
                    gl_FragColor = vec4( c, a);
                #else
                    ${Array.from({ length: this.slices-1}, (_, i) => "if(pixelPercent<=vRun" + i + ".x){curr=vRun" + i + ";}else{").join('')}
                    ${"curr=vRun" + (this.slices-1) + ";" + "}".repeat(this.slices-1)}
                    gl_FragColor = vec4( texture2D( nodeTex, vec2 ( curr.y , 1.0) ).xyz, a);
                #endif
                }`,
            side: THREE.FrontSide,
            transparent: true,
        });

        let geometry = new THREE.BufferGeometry();

        //Create paired attributes for pie slice run-length encoding
        for(let i=0; i<this.slices; i++) {
            let runVectors = new Float32Array(2 * this.instance_count).fill(1.0);
            geometry.addAttribute("run" + i, new THREE.BufferAttribute(runVectors, 2));
        }

        //Initialise node scales
        let offsets = new Float32Array(2 * this.instance_count).fill(0.0);
        let scales = new Float32Array(this.instance_count).fill(1.0);
        geometry.addAttribute("scale", new THREE.BufferAttribute(scales, 1));
        geometry.addAttribute("position", new THREE.BufferAttribute(offsets, 2));

        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), Infinity);
        geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, 0), new THREE.Vector3(0.5, 0.5, 0));

        this.mesh = new THREE.Points(geometry, this.material);
        this.mesh.frustumCulled = false;
        this.add(this.mesh);
    }

    setOffsetBuffer(node) {
        let array = this.mesh.geometry.attributes.position.array;
        array[2 * node.id + 0] = node.x;
        array[2 * node.id + 1] = node.y;
    }

    setScaleBuffer(node) {
        let array = this.mesh.geometry.attributes.scale.array;
        array[node.id] = node.getRadius();
    }

    setColorBuffer(node) {
        let array = this.mesh.geometry.attributes.run0.array;
        array[2 * node.id + 0] = 1.0;
        array[2 * node.id + 1] = node.color;
    }

    setPieBuffer(node, percentages, colors) {
        if(percentages.length <= this.slices) {
            for(let i=0, totalPercent=0; i<percentages.length; i++) {
                let array = this.mesh.geometry.attributes["run" + i].array;
                totalPercent += percentages[i];
                array[2 * node.id + 0] = totalPercent;
                array[2 * node.id + 1] = colors[i];
            }
        }
    }

    updateColors() {
        for(let i=0; i<this.slices; i++) {
            this.mesh.geometry.attributes["run" + i].needsUpdate = true;
        }
    }

    updateScales() {
        this.mesh.geometry.attributes.scale.needsUpdate = true;
    }

    updateOffsets() {
        this.mesh.geometry.attributes.position.needsUpdate = true;
    }

    calculateScale(value, min=2, max=8) {
        return value * (max - min) + min;
    }

    setPixelZoom(value) {
        this.material.uniforms.nodeZoom.value = value;
    }

    fillContext(ctx) {
        let scales = this.mesh.geometry.attributes.scale.array;
        let offsets = this.mesh.geometry.attributes.position.array;

        for(let i=0; i<this.instance_count; ++i) {
            let prev = undefined;
            let centerX = offsets[2 * i + 0];
            let centerY = offsets[2 * i + 1];

            for(let j=0; j<this.slices; ++j) {
                let array = this.mesh.geometry.attributes["run" + j].array;

                let startPercent = prev ? prev[2 * i + 0] : 0;
                let endPercent = array[2 * i + 0];

                prev = array;

                if(endPercent > 1.0 || startPercent == endPercent) continue;

                let color = array[2 * i + 1];

                let scale = scales[i];

                let startX = Math.cos(2 * Math.PI * (startPercent));
                let startY = Math.sin(2 * Math.PI * (startPercent));
                let endX =  Math.cos(2 * Math.PI * (endPercent));
                let endY =  Math.sin(2 * Math.PI * (endPercent));

                const largeArcFlag = (endPercent - startPercent) > 0.5 ? 1 : 0;

                 let pathData = [
                  `M ${startX} ${startY}`, // Move
                  `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Arc
                  `L 0 0`, // Line
                ].join(' ');

                ctx.save();
                ctx.fillColor('#' + this.colormap.getColor(color).getHexString().toUpperCase());
                ctx.path(pathData).translate(centerX, -centerY).scale(scale).rotate(-90);
                ctx.fill();
                ctx.restore();

                if(endPercent >= 1.0) break;
            }
        }
    }
}
