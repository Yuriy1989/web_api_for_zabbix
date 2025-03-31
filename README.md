# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**
# Описание

version 1.0.0
Модуль для zabbix, использующий API

1. Статистика по сервисам за выбранный период.
2. Выгрузка отчетов по Hosts, Groups, Templates.

# Установка

1. Создайте каталог Module_1 в каталоге modules вашей установки внешнего интерфейса Zabbix (например, zabbix/ui/modules).
2. Создайте файл manifest.json с метаданными базового модуля (см. описание поддерживаемых параметров).
```json
{
    "manifest_version": 2.0,
    "id": "my-address",
    "name": "My IP Address",
    "version": "1.0",
    "namespace": "MyAddress",
    "description": "My External IP Address."
}
```
