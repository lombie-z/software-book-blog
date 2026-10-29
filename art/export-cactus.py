"""Export the cactus for the web. Run: blender --background art/cactus.blend --python art/export-cactus.py"""
import os
import bpy

OUT = os.path.join(os.path.dirname(bpy.data.filepath), '..', 'public', 'models', 'cactus.glb')

root = bpy.data.objects['Cactus']
for o in bpy.context.view_layer.objects:
    o.select_set(False)
for o in [root, *root.children_recursive]:
    o.select_set(True)
bpy.context.view_layer.objects.active = root
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', use_selection=True, export_apply=True,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                          export_yup=True, export_cameras=False, export_lights=False)
print('exported', os.path.abspath(OUT), os.path.getsize(OUT))
