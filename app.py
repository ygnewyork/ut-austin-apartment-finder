# Flask web server for UT Austin apartment finder application

from flask import Flask, jsonify, render_template, request, make_response
import json
import os

app = Flask(__name__)


@app.route('/api/apartments')
def get_apartments():
    data_path = os.path.join(app.root_path, 'data', 'apartments.json')
    try:
        with open(data_path, 'r') as f:
            data = json.load(f)
        resp = make_response(jsonify(data))
        # cache API responses briefly to reduce reloads
        resp.cache_control.max_age = 300
        return resp
    except FileNotFoundError:
        return jsonify({"error": "apartments.json file not found"}), 404
    except json.JSONDecodeError:
        return jsonify({"error": "apartments.json is not valid JSON"}), 500


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/test')
def test():
    return render_template('test.html')


@app.route('/healthz')
def healthz():
    return 'ok', 200


@app.after_request
def add_cache_headers(resp):
    # Cache static assets aggressively
    if request.path.startswith('/static/'):
        resp.cache_control.public = True
        resp.cache_control.max_age = 31536000  # 1 year
    return resp


if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('FLASK_DEBUG') == '1'
    )
