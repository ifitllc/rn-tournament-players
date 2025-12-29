#!/bin/bash

# EAS Environment Variables Setup Script
# This script sets environment variables for Expo Application Services (EAS)

set -e

echo "🚀 Setting up EAS environment variables..."

# Check if eas-cli is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI is not installed."
    echo "📦 Install it with: npm install -g eas-cli"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📝 Please create a .env file from .env.example:"
    echo "   cp .env.example .env"
    exit 1
fi

# Load environment variables from .env
export $(cat .env | grep -v '^#' | xargs)

# Check if required variables are set
if [ -z "$EXPO_PUBLIC_GOOGLE_CLIENT_ID" ]; then
    echo "❌ EXPO_PUBLIC_GOOGLE_CLIENT_ID is not set in .env file"
    exit 1
fi

echo "📤 Setting EXPO_PUBLIC_GOOGLE_CLIENT_ID..."
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_CLIENT_ID --value "$EXPO_PUBLIC_GOOGLE_CLIENT_ID" --type string --force

if [ -n "$EXPO_PUBLIC_GOOGLE_DRIVE_FOLDER_ID" ]; then
    echo "📤 Setting EXPO_PUBLIC_GOOGLE_DRIVE_FOLDER_ID..."
    eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_DRIVE_FOLDER_ID --value "$EXPO_PUBLIC_GOOGLE_DRIVE_FOLDER_ID" --type string --force
fi

echo "✅ EAS environment variables set successfully!"
echo ""
echo "📋 To view your secrets, run:"
echo "   eas secret:list"
echo ""
echo "🏗️  To build with these variables, run:"
echo "   eas build --platform ios"
echo "   eas build --platform android"
