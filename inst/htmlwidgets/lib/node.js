const segments = 64;
class node {
	constructor(index, labelText, data, color, texture, parent) {
        this.index = index;
        Object.assign(this, data);

        //Create mesh
        var geometry = new THREE.BufferGeometry();
        var vertices = new Float32Array(6*segments);
        for(let i=0, j=0, k=0; i<segments; i++, j+=6, k+=3) {
            vertices[j] = vertices[j+1] = 0.0;
            var theta = i/segments * Math.PI * 2;
            vertices[j+2] = Math.sin(theta);
            vertices[j+3] = Math.cos(theta);
            theta = (i+1)/segments * Math.PI * 2;
            vertices[j+4] = Math.sin(theta);
            vertices[j+5] = Math.cos(theta);
        }

        //Generate random pie chart
        var uvs = new Float32Array(3 * segments);
        let curr = 0;
        for(let j=0; j<3 * segments; j++) {
            if(Math.random() < 0.02) {
                curr = Math.min(curr + Math.random()/2, 1.0);
            }
            uvs[j] = curr;
        }

        geometry.addAttribute("position", new THREE.BufferAttribute(vertices, 2).setDynamic(true));
        geometry.addAttribute("u", new THREE.BufferAttribute(uvs, 1));

        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1);
        geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, 0), new THREE.Vector3(0.5, 0.5, 0));

        this.material = new THREE.RawShaderMaterial({
            uniforms: {
                texture: { type: "t", value: texture },
            },
            vertexShader: [
                "precision highp float;",
                "",
                "uniform mat4 modelViewMatrix;",
                "uniform mat4 projectionMatrix;",
                "",
                "attribute vec2 position;",
                "attribute float u;",
                "varying float vU;",
                "",
                "void main() {",
                "",
                "   vU = u;",
                "	gl_Position = projectionMatrix * modelViewMatrix * vec4 ( position , 0.0, 1.0 );",
                "",
                "}"
                ].join("\n"),
            fragmentShader: [
                "precision highp float;",
                "",
                "uniform sampler2D texture;",
                "varying float vU;",
                "",
                "void main() {",
                "",
                "    gl_FragColor = texture2D( texture, vec2 ( vU, 0.0 ) );",
                "",
                "}"
                ].join("\n"),
          side: THREE.DoubleSide,
          transparent: false
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        
        this.setRadius(100);
        this.setColor(color);

        //Create label
        var nodeDiv = document.createElement('div');
        nodeDiv.className = 'unselectable label nlabel';
        nodeDiv.textContent = labelText;
        
        this.label = new THREE.CSS2DObject(nodeDiv);
        this.label.position.set(0, 0, 0);
        this.mesh.add(this.label);

        parent.add(this.mesh);
    }

    setRadius(value) {
        this.mesh.scale.set(value, value, 1);
        this.r = value;
    }

    setColor(value) {
        this.color = value;
    }

    getColor() {
        return this.color;
    }

    getPosition() {
        return this.mesh.position;
    }

    setPosition(x, y) {
        this.mesh.position.x = x;
        this.mesh.position.y = y;
    }

    setLabelText(text) {
        this.label.element.textContent = text;
    }
}