/**
 * 图标生成脚本
 * 使用方法: node scripts/generate-icons.js
 *
 * 需要安装: npm install sharp --save-dev
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(__dirname, '..', 'build');
const svgPath = path.join(buildDir, 'icon.svg');

// 生成不同尺寸的 PNG 图标
async function generatePngIcons() {
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512];

  for (const size of sizes) {
    const outputPath = path.join(buildDir, `${size}x${size}.png`);
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`✓ 生成: ${outputPath}`);
  }
}

// 生成 ICO 文件 (Windows)
async function generateIco() {
  // 使用 256x256 作为基础
  const png256 = path.join(buildDir, '256x256.png');
  const icoPath = path.join(buildDir, 'icon.ico');

  // 使用 sharp 生成 PNG，然后需要额外工具转换为 ICO
  // 这里我们先生成多个尺寸的 PNG
  const sizes = [16, 32, 48, 64, 128, 256];
  const buffers = [];

  for (const size of sizes) {
    const buffer = await sharp(svgPath)
      .resize(size, size)
      .png()
      .toBuffer();
    buffers.push(buffer);
  }

  // 简单的 ICO 格式生成
  // ICO 文件头
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // 保留字段
  header.writeUInt16LE(1, 2); // 类型: 1 = ICO
  header.writeUInt16LE(sizes.length, 4); // 图像数量

  // 目录条目
  const entries = [];
  let offset = 6 + sizes.length * 16; // 文件头 + 目录条目

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    const buffer = buffers[i];

    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // 宽度
    entry.writeUInt8(size === 256 ? 0 : size, 1); // 高度
    entry.writeUInt8(0, 2); // 颜色数量
    entry.writeUInt8(0, 3); // 保留
    entry.writeUInt16LE(1, 4); // 颜色平面
    entry.writeUInt16LE(32, 6); // 每像素位数
    entry.writeUInt32LE(buffer.length, 8); // 图像数据大小
    entry.writeUInt32LE(offset, 12); // 图像数据偏移

    entries.push(entry);
    offset += buffer.length;
  }

  // 组合成 ICO 文件
  const ico = Buffer.concat([
    header,
    ...entries,
    ...buffers
  ]);

  fs.writeFileSync(icoPath, ico);
  console.log(`✓ 生成 ICO: ${icoPath}`);
}

// 生成 ICNS 文件 (macOS)
async function generateIcns() {
  // macOS ICNS 格式较为复杂，这里生成 PNG 以便手动转换
  console.log('ℹ macOS 图标请使用在线工具或 IconUtil 生成');
  console.log('  推荐工具: https://cloudconvert.com/png-to-icns');

  // 生成 iconset 目录所需的 PNG
  const iconsetDir = path.join(buildDir, 'icon.iconset');
  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }

  const mappings = [
    { size: 16, name: 'icon_16x16.png' },
    { size: 32, name: 'icon_16x16@2x.png' },
    { size: 32, name: 'icon_32x32.png' },
    { size: 64, name: 'icon_32x32@2x.png' },
    { size: 128, name: 'icon_128x128.png' },
    { size: 256, name: 'icon_128x128@2x.png' },
    { size: 256, name: 'icon_256x256.png' },
    { size: 512, name: 'icon_256x256@2x.png' },
    { size: 512, name: 'icon_512x512.png' },
    { size: 1024, name: 'icon_512x512@2x.png' }
  ];

  for (const { size, name } of mappings) {
    const outputPath = path.join(iconsetDir, name);
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`✓ 生成: ${outputPath}`);
  }

  console.log('\n在 macOS 上运行以下命令生成 ICNS:');
  console.log(`  iconutil -c icns "${iconsetDir}"`);
}

// 主函数
async function main() {
  try {
    console.log('🎨 开始生成应用图标...\n');

    console.log('📦 生成 PNG 图标...');
    await generatePngIcons();

    console.log('\n🖥️ 生成 Windows ICO...');
    await generateIco();

    console.log('\n🍎 生成 macOS ICNS 资源...');
    await generateIcns();

    console.log('\n✅ 图标生成完成！');
  } catch (err) {
    console.error('❌ 生成图标失败:', err);
    process.exit(1);
  }
}

main();
