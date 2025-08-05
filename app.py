from flask import Flask, jsonify, render_template
import json
import os

app = Flask(__name__)


@app.route('/api/apartments')
def get_apartments():
    """
    Reads apartment data from the JSON file and returns it.
    """
    data_path = os.path.join(app.root_path, 'data', 'apartments.json')
    try:
        with open(data_path, 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify({"error": "apartments.json file not found"}), 404

# --- Frontend Route ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/test')
def test():
    return render_template('test.html')

if __name__ == '__main__':
    app.run(debug=True)
