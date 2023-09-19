import Cesium from '../utils/cesium/Cesium';

let viewer;
let scene;
let downHandler; // Select plane when mouse down.
let upHandler; // Release plane on mouse up.
let moveHandler; // Move plane on mouse move.

const clipObjects = ["BIM", "Point Cloud", "Instanced", "Model"];
const viewModel = {
  currentExampleType: "BIM",
  debugBoundingVolumesEnabled: false,
  edgeStylingEnabled: true,
}

let targetY = 0.0;
let planeEntities = [];
let selectedPlane;
let clippingPlanes;
let tileset;

// Power Plant design model provided by Bentley Systems
// const bimUrl = Cesium.IonResource.fromAssetId(1240402);
const bimUrl = `${import.meta.env.VITE_BUILD_PATH_PREFIX}/SampleData/3DTiles/PowerPlant/tileset.json`;
const pointCloudUrl = Cesium.IonResource.fromAssetId(16421);
const instancedUrl = "../SampleData/Cesium3DTiles/Instanced/InstancedOrientation/tileset.json";
const modelUrl = `${import.meta.env.VITE_BUILD_PATH_PREFIX}/SampleData/models/Cesium_Air.glb`;


const createPlaneUpdateFunction = (plane) => {
  return () => {
    plane.distance = targetY;
    return plane;
  };
}

const loadTileset = async (resource, modelMatrix) => {
  const currentExampleType = viewModel.currentExampleType;

  clippingPlanes = new Cesium.ClippingPlaneCollection({
    planes: [
      new Cesium.ClippingPlane(
        new Cesium.Cartesian3(0.0, 0.0, -1.0),
        0.0
      ),
    ],
    edgeWidth: viewModel.edgeStylingEnabled ? 1.0 : 0.0,
  });

  try {
    const url = await Promise.resolve(resource);
    tileset = await Cesium.Cesium3DTileset.fromUrl(url, {
      clippingPlanes: clippingPlanes,
    });

    if (currentExampleType !== viewModel.currentExampleType) {
      // Another tileset was loaded, discard the current result
      return;
    }

    if (Cesium.defined(modelMatrix)) {
      tileset.modelMatrix = modelMatrix;
    }

    viewer.scene.primitives.add(tileset);

    tileset.debugShowBoundingVolume =
      viewModel.debugBoundingVolumesEnabled;
    const boundingSphere = tileset.boundingSphere;
    const radius = boundingSphere.radius;

    viewer.zoomTo(
      tileset,
      new Cesium.HeadingPitchRange(0.5, -0.2, radius * 4.0)
    );

    if (
      !Cesium.Matrix4.equals(
        tileset.root.transform,
        Cesium.Matrix4.IDENTITY
      )
    ) {
      // The clipping plane is initially positioned at the tileset's root transform.
      // Apply an additional matrix to center the clipping plane on the bounding sphere center.
      const transformCenter = Cesium.Matrix4.getTranslation(
        tileset.root.transform,
        new Cesium.Cartesian3()
      );
      const transformCartographic = Cesium.Cartographic.fromCartesian(
        transformCenter
      );
      const boundingSphereCartographic = Cesium.Cartographic.fromCartesian(
        tileset.boundingSphere.center
      );
      const height = boundingSphereCartographic.height - transformCartographic.height;
      clippingPlanes.modelMatrix = Cesium.Matrix4.fromTranslation(
        new Cesium.Cartesian3(0.0, 0.0, height)
      );
    }

    for (let i = 0; i < clippingPlanes.length; ++i) {
      const plane = clippingPlanes.get(i);
      const planeEntity = viewer.entities.add({
        position: boundingSphere.center,
        plane: {
          dimensions: new Cesium.Cartesian2(radius * 2.5, radius * 2.5),
          material: Cesium.Color.WHITE.withAlpha(0.1),
          plane: new Cesium.CallbackProperty(
            createPlaneUpdateFunction(plane),
            false
          ),
          outline: true,
          outlineColor: Cesium.Color.WHITE,
        },
      });

      planeEntities.push(planeEntity);
    }
    return tileset;
  } catch (error) {
    console.log(`Error loading  tileset: ${error}`);
  }
}

const loadModel = (url) => {
  clippingPlanes = new Cesium.ClippingPlaneCollection({
    planes: [
      new Cesium.ClippingPlane(
        new Cesium.Cartesian3(0.0, 0.0, -1.0),
        0.0
      ),
    ],
    edgeWidth: viewModel.edgeStylingEnabled ? 1.0 : 0.0,
  });

  const position = Cesium.Cartesian3.fromDegrees(
    -123.0744619,
    44.0503706,
    300.0
  );
  const heading = Cesium.Math.toRadians(135.0);
  const pitch = 0.0;
  const roll = 0.0;
  const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
  const orientation = Cesium.Transforms.headingPitchRollQuaternion(
    position,
    hpr
  );
  const entity = viewer.entities.add({
    name: url,
    position: position,
    orientation: orientation,
    model: {
      uri: url,
      scale: 8,
      minimumPixelSize: 100.0,
      clippingPlanes: clippingPlanes,
    },
  });

  viewer.trackedEntity = entity;

  for (let i = 0; i < clippingPlanes.length; ++i) {
    const plane = clippingPlanes.get(i);
    const planeEntity = viewer.entities.add({
      position: position,
      plane: {
        dimensions: new Cesium.Cartesian2(300.0, 300.0),
        material: Cesium.Color.WHITE.withAlpha(0.1),
        plane: new Cesium.CallbackProperty(
          createPlaneUpdateFunction(plane),
          false
        ),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
    });

    planeEntities.push(planeEntity);
  }
};

const reset = (viewer) => {
  viewer.entities.removeAll();
  if (Cesium.defined(tileset)) {
    viewer.scene.primitives.remove(tileset);
  }

  planeEntities = [];
  targetY = 0.0;
  tileset = undefined;
};

export const selectClipObject = (val) => {
  viewModel.currentExampleType = val;

  reset();

  if (val === clipObjects[0]) {
    loadTileset(bimUrl);
  } else if (val === clipObjects[1]) {
    loadTileset(pointCloudUrl);
  } else if (val === clipObjects[2]) {
    // Position the instanced tileset above terrain
    loadTileset(
      instancedUrl,
      Cesium.Matrix4.fromTranslation(
        new Cesium.Cartesian3(15.0, -58.6, 50.825)
      )
    );
  } else {
    loadModel(modelUrl);
  }
};

export const selectBoundingVolumesEnabled = (val) => {
  viewModel.debugBoundingVolumesEnabled = val;

  if (Cesium.defined(tileset)) {
    tileset.debugShowBoundingVolume = val;
  }
};

export const selectStylingEnabled = (val) => {
  viewModel.edgeStylingEnabled = val;

  const edgeWidth = val ? 1.0 : 0.0;

  clippingPlanes.edgeWidth = edgeWidth;
};

export const demo3DTilesClippingPlanes = (viewer) => {
  // TODO change viewer option to false: infoBox, selectionIndicator

  viewer = viewer;
  scene = viewer.scene;

  // Select plane when mouse down.
  downHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  downHandler.setInputAction((movement) => {
    const pickedObject = scene.pick(movement.position);
    if (
      Cesium.defined(pickedObject) &&
      Cesium.defined(pickedObject.id) &&
      Cesium.defined(pickedObject.id.plane)
    ) {
      selectedPlane = pickedObject.id.plane;
      selectedPlane.material = Cesium.Color.WHITE.withAlpha(0.05);
      selectedPlane.outlineColor = Cesium.Color.WHITE;
      scene.screenSpaceCameraController.enableInputs = false;
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

  // Release plane on mouse up.
  upHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  upHandler.setInputAction(() => {
    if (Cesium.defined(selectedPlane)) {
      selectedPlane.material = Cesium.Color.WHITE.withAlpha(0.1);
      selectedPlane.outlineColor = Cesium.Color.WHITE;
      selectedPlane = undefined;
    }

    scene.screenSpaceCameraController.enableInputs = true;
  }, Cesium.ScreenSpaceEventType.LEFT_UP);

  // Move plane on mouse move.
  moveHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  moveHandler.setInputAction(function (movement) {
    if (Cesium.defined(selectedPlane)) {
      const deltaY = movement.startPosition.y - movement.endPosition.y;
      targetY += deltaY;
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);


  loadTileset(viewer, bimUrl);

};

export const destroyDemo3DTilesClippingPlanes = (viewer) => { };