from fastapi import FastAPI

app = FastAPI(title="TECNOMEGA API")


@app.get("/")
def root():
    return {"message": "API TECNOMEGA funcionando"}
