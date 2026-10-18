# Narrow sherpa-onnx build dependency patch

`sherpa-onnx-sys/` contains the source, build script, manifest, README and Apache-2.0 licence from the crates.io `sherpa-onnx-sys` 1.13.8 release. The original source is available at https://crates.io/crates/sherpa-onnx-sys/1.13.8 and https://github.com/k2-fsa/sherpa-onnx.

The only upstream manifest change is the build dependency on `zip`: version `2` is replaced by `9.0.5` with only store/deflate support enabled. This addresses the ZIP extraction advisories reported by RustSec without changing the validated sherpa-onnx native library version, FFI, engine configuration or model files. Windows native libraries are still obtained through the upstream tar.bz2 path. The crate's licence is retained in `sherpa-onnx-sys/LICENSE` and distributed with the existing sherpa-onnx runtime licence notice.

Separately, Dictum disables the Tauri updater's optional legacy archive feature. Windows releases use direct EXE/MSI update assets; their signatures and installation path remain enabled. This removes the unused ZIP 4 dependency rather than suppressing audit findings.

Remove this local patch when an upstream sherpa-onnx-sys release supports a fixed ZIP dependency and its native runtime has been validated with Dictum's supported models. Do not change the native ABI solely to remove this temporary patch. No RustSec advisory is ignored by this change.
