# Описание

version 1.0.0
Модуль для zabbix, использующий API

Модуль позволяет:
1. Выводить статистику по сервисам за выбранный период.
2. Выгружать отчеты по Hosts, Groups, Templates.

# Установка самого приложения написанного на React (можно встроить как в виде модуля в zabbix, так и использоваться как отдельное веб приложение). Разворчивать приложение будем в Docker.
1. Устанавливаем Docker и Docker-compose на сервере zabbix или на любом другом в Вашей инфраструктуре.
```bash
# Эта команда скачает скрипт для установки докера
wget https://get.docker.com/ -O get-docker.sh
# Эта команда запустит его
sh get-docker.sh   
sudo apt install docker-ce docker-compose -y 
```
2. Создаем папку под наш проект. Переходим в эту папку и клонируем репозиторий.
```bash
git clone https://github.com/Yuriy1989/web_api_for_zabbix.git
```
3. Нужно указать учетную запись и адрес сервера zabbix для работы приложения в файле ./src/utils/constants.js
```js
export const USER_NAME = "Admin";
export const PASSWORD = "zabbix";
export const ZABBIX_SERVER = "http://192.168.2.4:8080/api_jsonrpc.php";
export const URL_ZABBIX = "https://zabbix.home.ru"; //указать полное доменное имя адреса сервера
```
4. После этого необходимо собрать и запустить наше приложение.
```bash
cd web_api_for_zabbix
sudo docker-compose up --build -d
```
5. Приложение будет доступно по IP адреса сервера на котором собрали наше приложение по порту 3001.
Если нужно пересобрать приложение сперва нужно убить запущенный контейнер командой:
```bash
sudo docker-compose down
```

# Подключение модуля в zabbix если необходимо интегрировать веб приложение в интерфейс zabbix (все действия проделываем на сервере zabbix).

1. Создайте каталог ModuleWebReact в каталоге modules вашей установки внешнего интерфейса Zabbix (например, /usr/share/zabbix/modules/).

2. Создайте файл manifest.json с метаданными базового модуля (см. описание поддерживаемых параметров).
```json
{
    "manifest_version": 2.0,
    "id": "ModuleWebReact_v1",
    "name": "ModuleWebReact v1",
    "version": "1.0",
    "namespace": "ModuleWebReact",
    "author": "Yura Dudin",
    "description": "Module for zabbix React_v1",
    "actions": {
        "reactWebModule": {
            "class": "ModuleClass",
            "view": "module.view"
        }
    }
}
```
3. В веб-интерфейсе Zabbix перейдите в раздел Администрирование → Общие → Модули и нажмите кнопку Сканировать каталог.

4. Найдите в списке новый модуль ModuleWebReact и нажмите гиперссылку «Отключено», чтобы изменить статус модуля с «Отключено» на «Включено».
**Теперь модуль зарегистрирован во внешнем интерфейсе. Однако его пока не видно, поскольку вам еще нужно определить функциональность модуля. Как только вы добавите контент в каталог модуля, вы сразу увидите изменения в интерфейсе Zabbix после обновления страницы.**

5. Создайте файл Module.php в каталоге ModuleWebReact.
**Этот файл реализует новый класс Module, который расширяет класс CModule по умолчанию. Класс Module вставит новый раздел меню My Address в главное меню.**
```php
<?php
namespace Modules\ModuleWebReact;
use Zabbix\Core\CModule,
    APP,
    CMenuItem;
class Module extends CModule {
    public function init(): void {
        APP::Component()->get('menu.main')
            ->add((new CMenuItem(_('Module Web React')))
            ->setAction('reactWebModule'));
    }
}
```

6. Создайте каталог actions в каталоге ModuleWebReact.
Создайте файл ModuleClass.php в каталоге actions.
```php
<?php
namespace Modules\ModuleWebReact\Actions;
use CController,
    CControllerResponseData;
class ModuleClass extends CController {
    public function init(): void {
        $this->disableCsrfValidation();
    }
    protected function checkInput(): bool {
        return true;
    }
    protected function checkPermissions(): bool {
        return true;
    }
    protected function doAction(): void {
        // Создайте данные для ответа
        $data = ['script' => "<script>console.log('ModuleWebReact v1');</script>"];
        
        // Используйте CControllerResponseData для правильной обработки ответа
        $response = new CControllerResponseData($data);
        
        // Устанавливаем ответ
        $this->setResponse($response);
    }
}
```
7. Создайте новый каталог views в каталоге ModuleWebReact.
Создайте файл module.views.php в каталоге views и определите представление модуля. ВАЖНО в переменную url необходимо указать адрес и порт нашего собранного приложения.
```php
<?php 

$url = "http://192.168.2.14:3000/";

echo <<<HTML
<style>
    body, html {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden; /* Убираем скролл страницы */
    }

    iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: none;
    }
</style>

<iframe src="{$url}"></iframe>
HTML;
?>
```
