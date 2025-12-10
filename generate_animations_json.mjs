#!/usr/bin/env node

import { readdir } from 'fs/promises';
import { writeFile } from 'fs/promises';
import { join } from 'path';

async function findVRMAFiles(dir, baseDir = dir) {
    const files = [];

    try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
                // Recursively search subdirectories
                const subFiles = await findVRMAFiles(fullPath, baseDir);
                files.push(...subFiles);
            } else if (entry.name.endsWith('.vrma') || entry.name.endsWith('.glb')) {
                // Get relative path from base directory
                const relativePath = fullPath.replace(baseDir + '/', '');
                files.push(relativePath);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
    }

    return files;
}

function naturalSort(a, b) {
    // Extract directory and filename parts
    const parseFilename = (path) => {
        const parts = path.split('/');
        const filename = parts[parts.length - 1];
        const dir = parts[parts.length - 2] || '';

        // Extract numbers from directory and filename
        const dirMatch = dir.match(/(\d+)/);
        const fileMatch = filename.match(/(\d+)_(\d+)/);

        return {
            dir: dirMatch ? parseInt(dirMatch[1]) : 0,
            num1: fileMatch ? parseInt(fileMatch[1]) : 0,
            num2: fileMatch ? parseInt(fileMatch[2]) : 0,
            original: path
        };
    };

    const aParsed = parseFilename(a);
    const bParsed = parseFilename(b);

    // Sort by directory number first
    if (aParsed.dir !== bParsed.dir) {
        return aParsed.dir - bParsed.dir;
    }

    // Then by first number in filename
    if (aParsed.num1 !== bParsed.num1) {
        return aParsed.num1 - bParsed.num1;
    }

    // Then by second number in filename
    return aParsed.num2 - bParsed.num2;
}

async function generateAnimationsJSON() {
    const baseDir = '/Users/pstdenis/Downloads/VRE';
    const vrmaDir = join(baseDir, 'cmu_mocap_vrma');
    const outputFile = join(baseDir, 'animations.json');

    console.log('Searching for VRMA files in:', vrmaDir);

    const files = await findVRMAFiles(vrmaDir, baseDir);

    console.log(`Found ${files.length} VRMA/GLB files`);

    // Sort files numerically
    files.sort(naturalSort);

    // Write to JSON file
    const json = JSON.stringify(files, null, 4);
    await writeFile(outputFile, json, 'utf8');

    console.log(`✓ Generated ${outputFile}`);
    console.log(`  Total animations: ${files.length}`);

    // Show first 10 for verification
    console.log('\nFirst 10 animations:');
    files.slice(0, 10).forEach((file, i) => {
        console.log(`  ${i + 1}. ${file}`);
    });
}

generateAnimationsJSON().catch(console.error);
