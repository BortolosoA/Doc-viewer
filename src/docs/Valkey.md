# <center>**Instalação e Configuração - Valkey (Source)**</center>

## Índice
- [Valkey](#valkey)
   - [Instalação](#instalação-via-source-valkey)
   - [Criar User](#criar-user-do-valkey)
   - [Configurar .service](#criar-e-configurar-o-etcsystemdsystemvalkeyservice-do-valkey)
   - [Ajustar o .conf](#ajustar-o-arquivo-etcvalkeyvalkeyconf)
   - [Criar ACL](#crie-o-arquivo-acl)
   - [Aplicar configurações](#aplicar-configurações-e-rodar-o-valkeyservice)
   - [Criar User no **Valkey**](#crie-os-users)
---

## [Valkey](https://valkey.io/topics/)

### Instalação via Source (Valkey)

```bash
sudo apt install valkey valkey-redis-compat
```

### Criar user do valkey

```bash
sudo useradd -r -s /usr/sbin/nologin valkey

#Verificar se foi criado
id valkey
```

### Criar e configurar o `/etc/systemd/system/valkey.service` do valkey

```toml
[Unit]
Description=Advanced key-value store
After=network.target
ConditionPathExists=!/etc/valkey/REDIS_MIGRATION
Documentation=https://valkey.io/docs/, man:valkey-server(1)

[Service]
Type=notify
ExecStart=/usr/bin/valkey-server /etc/valkey/valkey.conf --supervised systemd --daemonize no
PIDFile=/run/valkey/valkey-server.pid
TimeoutStopSec=0
Restart=always
User=valkey
Group=valkey
RuntimeDirectory=valkey
RuntimeDirectoryMode=2755

UMask=007
PrivateTmp=true
LimitNOFILE=65535
PrivateDevices=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=-/var/lib/valkey
ReadWritePaths=-/var/log/valkey
ReadWritePaths=-/var/run/valkey

CapabilityBoundingSet=
LockPersonality=true
MemoryDenyWriteExecute=true
NoNewPrivileges=true
PrivateUsers=true
ProtectClock=true
ProtectControlGroups=true
ProtectHostname=true
ProtectKernelLogs=true
ProtectKernelModules=true
ProtectKernelTunables=true
ProtectProc=invisible
RemoveIPC=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictNamespaces=true
RestrictRealtime=true
RestrictSUIDSGID=true
SystemCallArchitectures=native
SystemCallFilter=@system-service
SystemCallFilter=~ @privileged @resources

# valkey-server can write to its own config file when in cluster mode so we
# permit writing there by default. If you are not using this feature, it is
# recommended that you remove this line.
ReadWriteDirectories=-/etc/valkey

# This restricts this service from executing binaries other than valkey-server
# itself. This is really effective at e.g. making it impossible to an
# attacker to spawn a shell on the system, but might be more restrictive
# than desired. If you need to, you can permit the execution of extra
# binaries by adding an extra ExecPaths= directive with the command
# systemctl edit valkey-server.service
NoExecPaths=/
ExecPaths=/usr/bin/valkey-server /usr/lib /lib

[Install]
WantedBy=multi-user.target
Alias=valkey.service
```

### Ajustar o arquivo `/etc/valkey/valkey.conf`

```conf
# Ajustar o limite de memória
maxmemory <quantidade>gb
# Adicionar o acl (access list) files
aclfile /etc/valkey/users.acl
```

### Crie o arquivo ACL

```bash
sudo touch /etc/valkey/users.acl
sudo chown valkey:valkey /etc/valkey/users.acl
sudo systemctl restart valkey
```

### Aplicar Configurações e rodar o `valkey.service`

```bash
sudo systemctl daemon-reload
sudo systemctl restart valkey-server.service
sudo systemctl enable --now valkey
sudo systemctl status valkey-server.service
```

### Crie os users

#### Acesse o teminal do valkey com o `valkey-cli` e configure os users com o comando

```bash
#Mantenha o ">" antes do <senha>
ACL SETUSER <username> on ><senha> ~* &* +@all
ACL SAVE
```

