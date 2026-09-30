# About

This is a web client for sending and receiving Telegram text messages via the [green-api](https://green-api.com/) API gateway.
The application uses React, React Router, base-ui, and TanStack Query.

## API Interaction

Three parameters are used to send API requests:
apiUrl – API host URL
idInstance – unique instance ID
apiTokenInstance – instance access key
Retrieving user chatId:
https://green-api.com/telegram/docs/api/service/CheckAccount/

Retrieving the chat list:
https://green-api.com/telegram/docs/api/service/GetChats/

Retrieving user name and avatar:
https://green-api.com/telegram/docs/api/service/GetContactInfo/

Retrieving chat history (request sent for each chat upon initial load and when opening a chat):
https://green-api.com/telegram/docs/api/journals/GetChatHistory/

Sending a message:
https://green-api.com/telegram/docs/api/sending/SendMessage/

Receiving notifications about new messages (polled every 5 seconds; received messages are removed from the queue via https://green-api.com/telegram/docs/api/receiving/technology-http-api/DeleteNotification/):
https://green-api.com/telegram/docs/api/receiving/technology-http-api/

Only text messages are supported. TanStack Query is used for API requests.

Create DTO types for all API entities, differentiate them from client level entities.

## UI Screens

Screen 1: Input form for idInstance and apiTokenInstance fields.

Screen 2: Left sidebar displays the chat list (/GetChats); the header contains an input field and search button to add a new chat by phone number (sends /CheckAccount request to retrieve chatId; returns an error if the account does not exist).
The main screen content is the chat interface.
For chats in the sidebar, the name, avatar, and "last seen" status (retrieved via `/GetContactInfo`) are loaded. The user's name and avatar are also displayed at the top of the main section. Only text messages are supported.
The left sidebar must display the most recent message for each chat. Upon receiving a new message, the preview in the sidebar updates, as does the display within the chat itself if it is currently open.

The interface style must precisely replicate the Telegram Web App design.
Unsent messages are stored in a MobX store and synchronized with `localStorage` as drafts using `mobx-persist` (without decorators).

`base-ui` is used as the foundation for the UI kit, utilizing CSS Modules and CSS variables. The interface must support standard breakpoints (sm, md, lg, xl).
Errors should be displayed using a Toast component.

Use design references for screens in [.agents/design-references](/.agents/design-references/)

## Codestyle
Use eslint and prettier config for code styling.
Use @ alias for /src in es imports.

