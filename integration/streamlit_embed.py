"""Example: show ERP Lab inside a Streamlit course app.

Run ERP Lab as its own service first (python run.py, or docker compose up), then:

    streamlit run integration/streamlit_embed.py

Set ERP_LAB_URL if it runs somewhere other than http://localhost:8000.
"""

import os

import streamlit as st
import streamlit.components.v1 as components

ERP_LAB_URL = os.environ.get("ERP_LAB_URL", "http://localhost:8000")

st.set_page_config(page_title="Epoching & ERP", layout="wide")
st.title("Epoching & ERP")
st.caption(f"Interactive module served from {ERP_LAB_URL}. [Open it in its own tab]({ERP_LAB_URL})")
components.iframe(ERP_LAB_URL, height=900, scrolling=True)
