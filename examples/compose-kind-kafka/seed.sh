port=${1:-8080}
http POST localhost:${port}/api/sources @payloads/source.json
http POST localhost:${port}/api/destinations @payloads/destination.json
http POST localhost:${port}/api/pipelines @payloads/pipeline.json