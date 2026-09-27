#!/bin/bash
echo "Starting build process..."
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "Checking for MongoDB URI..."
if [ -z "$MONGODB_URI" ]; then
  echo "WARNING: MONGODB_URI is not set!"
else
  echo "MONGODB_URI is set (value hidden for security)"
fi
echo "Installing dependencies..."
npm install
echo "Building the application..."
npm run build
