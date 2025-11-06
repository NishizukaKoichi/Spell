;; Simple Hello World WASM Module
;; This module demonstrates basic text processing in WASM
;; It exports a simple function that returns a success code

(module
  ;; Import memory from the host
  (import "env" "memory" (memory 1))

  ;; Export the execute function
  (func (export "execute") (param i32) (result i32)
    ;; Input parameter is a pointer to input data
    ;; Return 0 for success
    i32.const 0
  )

  ;; Export main function for WASI
  (func (export "main") (result i32)
    i32.const 0
  )
)
