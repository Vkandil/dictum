fn main() {
    // The build dependency ensures the versioned native runtime is ready before packaging.
    // Copy it into a predictable resource directory for both NSIS and MSI installations.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let out = std::path::PathBuf::from(std::env::var("OUT_DIR").expect("Cargo OUT_DIR"));
        let profile = out.ancestors().nth(3).expect("Cargo profile directory");
        let runtime = std::path::PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap())
            .join("native-runtime");
        std::fs::create_dir_all(&runtime).expect("native runtime directory");
        let test_runtime = profile.join("deps");
        std::fs::create_dir_all(&test_runtime).expect("test runtime directory");
        for name in [
            "onnxruntime.dll",
            "onnxruntime_providers_shared.dll",
            "sherpa-onnx-c-api.dll",
            "sherpa-onnx-cxx-api.dll",
        ] {
            let bytes = std::fs::read(profile.join(name))
                .expect("Native runtime DLL missing; rebuild sherpa-onnx-sys");
            // Integration tests execute in deps/. Keep the pinned DLLs beside
            // them so an unrelated ONNX Runtime on PATH cannot shadow our ABI.
            for directory in [&runtime, &test_runtime] {
                let target = directory.join(name);
                if std::fs::read(&target).ok().as_deref() != Some(bytes.as_slice()) {
                    std::fs::write(target, &bytes).expect("Could not copy native runtime");
                }
            }
        }
    }
    tauri_build::build()
}
