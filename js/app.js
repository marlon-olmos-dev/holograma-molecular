'use strict';

// COLORES DE ATOMOS
const ATOM_COLORS = {
    C: 0x2288ff, //Carbono: azul
    H: 0xff3333, //Hidrogeno: rojo
    O: 0xffffff, //Oxigeno: blanco
    N: 0xaa44ff, //Nitrogeno: violeta
};

// Radio visual de cada tipo de atomo
const ATOM_RADII = {
    C: 0.28, 
    H: 0.18,
    O: 0.26,
    N: 0.26,
}

// Definimos las moleculas
const MOLECULAS = {
    water: {
        name: 'Agua',
        formula: 'H₂O',
        atoms: [
            { symbol: 'O', x: 0.00, y: 0.10, z: 0.00 },
            { symbol: 'H', x: -0.52, y: -0.38, z: 0.00},
            { symbol: 'H', x: 0.52, y: -0.38, z:0.00},
        ],
        bonds: [ [0, 1], [0, 2] ],
    },

    co2: {
        name: 'Dioxido de Carbono',
        formula: 'CO₂',
        atoms: [
            { symbol: 'O', x: -0.80, y: 0.00, z: 0.00 },
            { symbol: 'C', x: 0.00, y: 0.00, z: 0.00 },
            { symbol: 'O', x: 0.80, y: 0.00, z: 0.00 },
        ],
        bonds: [ [0, 1], [1, 2] ],
    },

    methane: {
        name: 'Metano',
        formula: 'CH₄',
        atoms: [
            { symbol: 'C', x: 0.000, y: 0.000, z: 0.000 },
            // Los 4 H en los vertices de un tetraedro celular
            { symbol: 'H', x: 0.577, y: 0.577, z: 0.577 },
            { symbol: 'H', x: -0.577, y: -0.577, z: 0.577 },
            { symbol: 'H', x: -0.577, y: 0.577, z: -0.577 },
            { symbol: 'H', x: 0.577, y: -0.577, z: -0.577 },
        ],
        bonds: [ [0,1], [0,2], [0,3], [0,4] ],
    },

    ammonia: {
        name: 'Amoniaco',
        formula: 'NH₃',
        atoms: [
            { symbol: 'N', x: 0.000, y: 0.300, z: 0.000 },
            { symbol: 'H', x: 0.620, y: -0.200, z: 0.000 },
            { symbol: 'H', x: -0.310, y: -0.200, z: 0.537 },
            { symbol: 'H', x: -0.310, y: -0.200, z: -0.537 },
        ],
        bonds: [ [0,1], [0,2], [0,3] ],
    },

};

// VARIABLES GLOBALES DE LA APLICACION

// Escena 3D compartida por las 4 vistas
let scene;

// Camara compartida (pespectiva)
let camera;

// Los 4 renderers, uno por canvas
let renderers = {};

// Luz ambiental y luz de punto
let ambientLight, pointLight1, pointLight2;

// Grupo 3D que contiene la molecula actual
let moleculeGroup = null;

// Estado de la animacion
let isRotating = true;
let animationId = null;

// Angulo de rotacion acumulado
let rotY = 0;
let rotX = 0.3;

// INICIALIZACION - inicia la escena Three.js
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); //negro absoluto
    
    // CAMARA
    camera = new THREE.PerspectiveCamera(
        45,
        1,
        0.1,
        100
    );
    camera.position.set(0, 0, 3.2);
    camera.lookAt(0, 0, 0);

    // LUCES
    ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    //Luz principal
    pointLight1 = new THREE.PointLight(0x00e5ff, 1.5, 20);
    pointLight1.position.set(2, 3, 3);
    scene.add(pointLight1);

    // Luz de relleno
    pointLight2 = new THREE.PointLight(0xaa44ff, 0.8, 20);
    pointLight2.position.set(-2, -1, -2);
    scene.add(pointLight2);

    // RENDERERS
    //Creamos un WebGLRenderer por cada canvas
    const canvasIds = ['canvas-top', 'canvas-left', 'canvas-right', 'canvas-bottom'];

    canvasIds.forEach(id => {
        const canvas = document.getElementById(id);
        const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: false,
        });

        // Tamaño fisico del canvas
        const size = getViewSize();
        renderer.setSize(size, size, false);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Tono mapping para aspecto mas holografico
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;

        renderers[id] = renderer;
    });

    // MOLECULA INICIAL
    loadMolecule('water');

    // EVENTOS
    document.getElementById('molecula-select').addEventListener('change', e => {
        loadMolecule(e.target.value);
    });

    window.addEventListener('resize', onResize);

    // INICIA BUCLE
    animate();
}

// GEOMETRIA: CREACION DE MOLECULAS
function createAtom(symbol, x, y, z) {
    const radius = ATOM_RADII[symbol] || 0.2;
    const color = ATOM_COLORS[symbol] || 0x888888;

    const geometry = new THREE.SphereGeometry(radius, 24, 24);
    const material = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.18, //leve brillo
        shininess: 90,
        specular: 0xffffff,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    return mesh;
}

// CILINDRO 3D ENTRE PUNTO A Y B
function createBond(posA, posB) {
    const direction = new THREE.Vector3().subVectors(posB, posA);
    const length = direction.length();
    const midpoint = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5);

    const geometry = new THREE.CylinderGeometry(0.055, 0.055, length, 12, 1);
    const material = new THREE.MeshPhongMaterial({
        color: 0x00e5ff, //cian holografico
        emissive: 0x004466,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.82,
        shininess: 120,
    });

    const mesh = new THREE.Mesh(geometry, material);

    //Posicionar en el punto medio
    mesh.position.copy(midpoint);

    // Se orienta el cilindro a lo largo del eje del enlace
    const axis = new THREE.Vector3(0, 1, 0);
    mesh.quaternion.setFromUnitVectors(axis, direction.normalize());

    return mesh;
}

// CARGA Y RENDERIZA UNA MOLECULA EN LA ESCENA - ELIMINA LA MOLECULA ANTERIOR SI EXISTE
function loadMolecule(key) {
    const molDef = MOLECULAS[key];
    if (!molDef) return;

    //Eliminar molecula anterior
    if (moleculeGroup) {
        moleculeGroup.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
        scene.remove(moleculeGroup);
        moleculeGroup = null;
    }

    // Creamos nuevo grupo para esta molecula
    moleculeGroup = new THREE.Group();

    // Creamos atomos
    const positions = []; // guardamos las posiviones para los enlaces
    molDef.atoms.forEach(atomDef => {
        const mesh = createAtom(atomDef.symbol, atomDef.x, atomDef.y, atomDef.z);
        moleculeGroup.add(mesh);
        positions.push(new THREE.Vector3(atomDef.x, atomDef.y, atomDef.z));
    });

    //Creamos enlaces
    molDef.bonds.forEach(([iA, iB]) => {
        const bond = createBond(positions[iA], positions[iB]);
        moleculeGroup.add(bond);
    });

    scene.add(moleculeGroup);

    // Actualizamos UI
    document.getElementById('molecula-formula').textContent = molDef.formula;
    document.getElementById('molecula-nombre').textContent = molDef.name;
}

// ANIMACION Y RENDERIZADO
function animate() {
    animationId = requestAnimationFrame(animate);

    // Rotamos suavemente si esta activo
    if (isRotating && moleculeGroup) {
        rotY += 0.008; //velocidad de rotacion horizontal
        rotX = 0.3 + Math.sin(rotY * 0.4) * 0.15; //leve oscilacion vertical
        moleculeGroup.rotation.y = rotY;
        moleculeGroup.rotation.x = rotX;
    }

    // Renderizacion de las 4 vistas con la misma camara y escena
    Object.values(renderers).forEach(renderer => {
        renderer.render(scene, camera);
    });
}

// UTILIDADES 
function getViewSize() {
    const style = getComputedStyle(document.documentElement);
    return parseInt(style.getPropertyValue('--view-size')) || 160;
}

// Actualiza el tamaño de los renderers al cambiar el tamaño de la pantalla
function onResize() {
    const size = getViewSize();
    Object.values(renderers).forEach(render => {
        render.setSize(size, size, false);
    });
}

// ARRANQUE
// Esperar a que el DOM este listo
window.addEventListener('DOMContentLoaded', init);