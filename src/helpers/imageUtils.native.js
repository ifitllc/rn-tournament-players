
export async function squareCrop(uri) {
  const ImageManipulator = require('expo-image-manipulator');
  const meta = await ImageManipulator.manipulateAsync(uri, [], { compress: 0.9 });
  const size = Math.min(meta.width ?? 0, meta.height ?? 0);
  const originX = ((meta.width ?? size) - size) / 2;
  const originY = ((meta.height ?? size) - size) / 2;
  return ImageManipulator.manipulateAsync(uri, [
    { crop: { originX, originY, width: size, height: size } },
  ]);
}
