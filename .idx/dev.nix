{ pkgs, ... }: {
  # Canal actualizado a 24.05 para asegurar acceso a las últimas versiones de herramientas
  channel = "stable-24.05";
  
  packages = [
    pkgs.nodejs_24
    pkgs.pnpm # Uso directo del paquete pnpm (más actualizado que nodePackages.pnpm)
    pkgs.nodePackages.firebase-tools
    pkgs.jdk17 # Necesario para correr Firebase Local Emulator Suite
  ];
  
  env = {};
  
  idx = {
    extensions = [
      "Vue.official" # El ID oficial moderno para la extensión de Vue (antes Vue.volar)
      "esbenp.prettier-vscode"
      "dbaeumer.vscode-eslint"
      "mtxr.sqltools"
    ];
    
    workspace = {
      onCreate = {
        # Se ejecuta una vez cuando el workspace es creado
        npm-install = "pnpm install";
      };
      onStart = {
        # Se ejecuta cada vez que el workspace se inicia
        start-emulators = "firebase emulators:start --project demo-cgpa-platform";
      };
    };
    
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["pnpm" "--filter" "client" "dev" "--" "--port" "$PORT" "--host" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}
