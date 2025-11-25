-- Criar enum para tipos de dispositivos
CREATE TYPE dispositivo_tipo AS ENUM (
  'smart_tv',
  'roku_tv', 
  'fire_stick',
  'android_tv',
  'celular_android',
  'celular_ios',
  'computador',
  'mac',
  'tablet_android',
  'tablet_ios',
  'chromecast',
  'apple_tv',
  'xbox',
  'playstation'
);

-- Adicionar coluna de dispositivo na tabela clientes
ALTER TABLE clientes 
ADD COLUMN dispositivo_contratado dispositivo_tipo;

-- Adicionar comentário explicativo
COMMENT ON COLUMN clientes.dispositivo_contratado IS 'Dispositivo principal que o cliente utiliza para acessar o serviço';