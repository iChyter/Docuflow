#!/bin/bash
# DocuFlow - Script de Deployment para Supabase
# Usage: ./deploy.sh

set -e

echo "=========================================="
echo "DocuFlow - Supabase Deployment Script"
echo "=========================================="

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Verificar que Supabase CLI esté instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI no está instalado${NC}"
    echo "Instala con: npm install -g supabase"
    exit 1
fi

# Verificar que we're logged in
echo -e "${YELLOW}Verificando autenticación...${NC}"
supabase projects list > /dev/null 2>&1 || {
    echo -e "${RED}No estás autenticado en Supabase${NC}"
    echo "Ejecuta: supabase login"
    exit 1
}

# Obtener project ref
if [ -z "$1" ]; then
    echo "Usage: ./deploy.sh <project-ref>"
    echo "Project ref es el ID de tu proyecto en Supabase (ej: abcdefghijklmnop)"
    exit 1
fi

PROJECT_REF=$1

echo -e "${GREEN}Conectando al proyecto: $PROJECT_REF${NC}"
supabase link --project-ref $PROJECT_REF

echo ""
echo -e "${YELLOW}1/6 Desplegando función: auth${NC}"
supabase functions deploy auth

echo -e "${YELLOW}2/6 Desplegando función: users${NC}"
supabase functions deploy users

echo -e "${YELLOW}3/6 Desplegando función: files${NC}"
supabase functions deploy files

echo -e "${YELLOW}4/6 Desplegando función: comments${NC}"
supabase functions deploy comments

echo -e "${YELLOW}5/6 Desplegando función: logs${NC}"
supabase functions deploy logs

echo -e "${YELLOW}6/6 Desplegando función: dashboard${NC}"
supabase functions deploy dashboard

echo -e "${YELLOW}6/6 Desplegando función: notifications${NC}"
supabase functions deploy notifications

echo ""
echo -e "${GREEN}=========================================="
echo "Deployment completado!"
echo "==========================================${NC}"
echo ""
echo "Ahora:"
echo "1. Ve al SQL Editor y ejecuta: supabase/sql/schema.sql"
echo "2. Crea el bucket 'documents' en Storage"
echo "3. Actualiza config.js con tu PROJECT_REF"
echo "4. Despliega el frontend a Vercel"
