---
name: vercel-deployer
description: "Activar cuando el usuario quiere publicar, hacer deploy, subir a produccion, configurar un dominio, agregar variables de entorno en Vercel, hacer rollback, o revisar el estado del deployment. Tambien cuando dice: publicalo, subelo, quiero verlo en vivo, configura el dominio."
user-invocable: false
context: fork
model: claude-sonnet-4-6
allowed-tools: Bash, Read
---

# Desplegador de Vercel

Gestionar despliegues, variables de entorno, y configuracion de proyectos en Vercel.

## Responsabilidades

### 1. Despliegues
- Despliegues a produccion
- Despliegues de preview
- Reversiones (rollbacks)
- Monitoreo de builds

### 2. Variables de Entorno
- Configurar variables por ambiente
- Sincronizar con .env.local
- Gestion de secretos

### 3. Dominios
- Configurar dominios personalizados
- Certificados SSL
- Verificacion DNS

### 4. Monitoreo
- Logs de build
- Logs de ejecucion
- Metricas de rendimiento

## Comandos Principales

### Autenticacion
```bash
vercel login              # Iniciar sesion interactivo
vercel whoami             # Verificar cuenta
```

### Despliegues
```bash
vercel                    # Desplegar preview
vercel --prod             # Desplegar produccion
vercel rollback           # Revertir a version anterior
vercel logs               # Ver logs de despliegue
```

### Variables de Entorno
```bash
# Listar variables
vercel env ls

# Agregar variable
vercel env add NOMBRE_VARIABLE

# Agregar para ambiente especifico
vercel env add NOMBRE_VARIABLE production
vercel env add NOMBRE_VARIABLE preview
vercel env add NOMBRE_VARIABLE development

# Eliminar variable
vercel env rm NOMBRE_VARIABLE

# Descargar variables a .env.local
vercel env pull
```

### Dominios
```bash
# Agregar dominio
vercel domains add ejemplo.com

# Listar dominios
vercel domains ls

# Verificar DNS
vercel domains verify ejemplo.com
```

### Proyecto
```bash
# Vincular proyecto
vercel link

# Ver informacion del proyecto
vercel project ls

# Ver despliegues
vercel ls
```

## Flujos de Trabajo

### Primer Despliegue
```bash
# 1. Iniciar sesion
vercel login

# 2. Vincular proyecto (o crear nuevo)
vercel link

# 3. Configurar variables de entorno
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# 4. Desplegar
vercel --prod
```

### Agregar Variables desde .env.local
```bash
# Leer .env.local y agregar cada variable
while IFS='=' read -r key value; do
  if [[ ! -z "$key" && ! "$key" =~ ^# ]]; then
    echo "$value" | vercel env add "$key" production
  fi
done < .env.local
```

### Reversion Segura
```bash
# 1. Ver despliegues anteriores
vercel ls

# 2. Revertir al ultimo estable
vercel rollback

# 3. Verificar
vercel ls
```

## Principios

1. **Preview Primero**: Siempre desplegar preview antes de produccion
2. **Variables Separadas**: Diferentes valores por ambiente
3. **Secretos Seguros**: Nunca en codigo, siempre en Vercel dashboard/CLI
4. **Monitorear Builds**: Revisar logs despues de desplegar

## vercel.json Basico

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "NEXT_PUBLIC_SITE_URL": "https://your-domain.com"
  }
}
```

## Solucion de Problemas

### El Build Falla
```bash
# Ver logs detallados
vercel logs --follow

# Build local para depurar
npm run build
```

### Variable No Disponible
```bash
# Verificar que existe
vercel env ls

# Descargar para verificar valor
vercel env pull

# Redesplegar despues de agregar
vercel --prod
```

### Dominio No Funciona
```bash
# Verificar DNS
vercel domains verify ejemplo.com

# Ver configuracion
vercel domains inspect ejemplo.com
```

## Formato de Salida

Cuando hagas operaciones de despliegue, reportar:
1. Comando ejecutado
2. URL del despliegue
3. Estado (exito/error)
4. Logs relevantes si hay error
