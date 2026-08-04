module staticserver

// Kept in step with the Dockerfile builder (golang:1.26-alpine), which is the
// source of truth. The directive is not cosmetic: it sets the GODEBUG
// compatibility baseline, so an older value bakes hardening OPT-OUTS into every
// binary built here (verified by diffing `go version -m` across builds).
go 1.26
