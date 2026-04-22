{ pkgs, ... }: {
  channel = "stable-23.11";
  packages = [
    pkgs.nodejs_24
    pkgs.nodePackages.pnpm
    pkgs.nodePackages.firebase-tools
    pkgs.jdk17
  ];
  env = {};
  idx = {
    extensions = [
      "Vue.volar"
      "esbenp.prettier-vscode"
      "dbaeumer.vscode-eslint"
      "mtxr.sqltools"
    ];
    workspace = {
      onCreate = {
        npm-install = "pnpm install";
      };
      onStart = {
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
