#!/usr/bin/env bash
# Compile le moteur d'images (stable-diffusion.cpp) pour Android arm64.
# Résultat : app/src/main/jniLibs/arm64-v8a/libjarvis_sd.so
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SDK="${ANDROID_HOME:-/opt/android-sdk}"
NDK="${ANDROID_NDK:-$(ls -d "$SDK"/ndk/* | sort -V | tail -1)}"
CMAKE_BIN="$(ls -d "$SDK"/cmake/*/bin | sort -V | tail -1)"
SDCPP_COMMIT=b13a482   # version figée (18 oct. 2026)
WORK="${WORK:-$HERE/.work}"
mkdir -p "$WORK"
if [ ! -d "$WORK/sdcpp" ]; then
  git clone https://github.com/leejet/stable-diffusion.cpp "$WORK/sdcpp"
fi
git -C "$WORK/sdcpp" checkout -q "$SDCPP_COMMIT"
git -C "$WORK/sdcpp" submodule update --init --recursive ggml
"$CMAKE_BIN/cmake" -S "$HERE" -B "$WORK/build" -G Ninja \
  -DCMAKE_MAKE_PROGRAM="$CMAKE_BIN/ninja" \
  -DCMAKE_TOOLCHAIN_FILE="$NDK/build/cmake/android.toolchain.cmake" \
  -DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM=android-31 -DANDROID_STL=c++_static \
  -DCMAKE_BUILD_TYPE=Release -DSDCPP_DIR="$WORK/sdcpp" \
  -DGGML_CPU_ARM_ARCH=armv8.2-a+dotprod+fp16
"$CMAKE_BIN/ninja" -C "$WORK/build" jarvis_sd
OUT="$HERE/../app/src/main/jniLibs/arm64-v8a"
mkdir -p "$OUT"
"$NDK"/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-strip -o "$OUT/libjarvis_sd.so" "$WORK/build/libjarvis_sd.so"
ls -lh "$OUT/libjarvis_sd.so"
