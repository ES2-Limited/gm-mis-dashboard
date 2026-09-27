#!/bin/bash

# SPIN GM-MIS Deployment Script
# Usage: ./deploy.sh

set -e

echo "================================================"
echo "  Deploying SPIN GM-MIS Dashboard"
echo "  Target: spin.bayabotech.com"
echo "  Server: 24.199.124.229"
echo "================================================"

# Check if ansible is installed
if ! command -v ansible-playbook &> /dev/null; then
    echo "Error: ansible-playbook not found. Please install Ansible first."
    echo "  brew install ansible"
    exit 1
fi

# Navigate to script directory
cd "$(dirname "$0")"

# Build the application locally
echo ""
echo "Building application..."
echo ""
(cd ../.. && npm run build)

# Run ansible playbook
echo ""
echo "Starting deployment..."
echo ""

ansible-playbook playbook.yml -v

echo ""
echo "================================================"
echo "  Deployment completed!"
echo "  Dashboard: https://spin.bayabotech.com"
echo "================================================"
