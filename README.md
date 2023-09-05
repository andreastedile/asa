# Autonomous Software Agents

Build:
```shell
npm run build
```

Single-agent setup:

```shell
npm start TOKEN 
```

Two-agent setup:

```shell
npm start TOKEN 1
```
(Notice the 1 at the end).


Unfortunately, I had no time to add a command line argument parser. Therefore:

To change reconsideration strategy between bold and cautious:
- Comment/uncomment line 274 and 275 in index.ts

To change commitment strategy between BacktrackCommitment and MaxConsecutiveFailuresCommitment:
- Comment/uncomment line 329 and 330 in index.ts


