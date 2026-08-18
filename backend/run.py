# """Entry point. `python run.py` starts the Flask dev server."""
# import os
# from app import create_app

# app = create_app(os.getenv("FLASK_ENV", "development"))

# if __name__ == "__main__":
#     app.run(host="0.0.0.0", port=5000, debug=app.config.get("DEBUG", False))
"""Dev entry point. `python run.py` to start the server."""
from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
