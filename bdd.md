# BDD Scenarios — Linear prompt-chain graphs

Scenarios derived from tickets B, C, D, and E.  
Pattern: **Given / When / Then / And** (at most two `And`s per scenario).

---

## B — Graph definition on disk

### Scenario: Load a hand-written graph from disk

Given a graph file named `draft` lives under the project's graphs folder  
When I ask the system for graph `draft`  
Then I receive its name, description, nodes, and edges as written  
And each node's optional insert and append text is preserved

### Scenario: List graphs that exist on disk

Given one or more valid graph files are saved in the graphs folder  
When I list graphs  
Then each saved graph appears in the list

### Scenario: Graphs live next to profiles

Given a project with a Rune data folder  
When I resolve where graphs are stored  
Then that location is the graphs folder inside the Rune data folder

### Scenario: Bad graph file fails clearly

Given a graph file whose contents are not valid TOML  
When I try to load that graph  
Then loading fails with a clear, actionable error  
And I do not get an empty or silent graph

### Scenario: Missing graph is simply absent

Given no graph file exists for id `missing`  
When I ask for graph `missing`  
Then the result is that the graph was not found

---

## C — Graph check CLI

### Scenario: Check a valid linear graph

Given a graph with a single chain of nodes from start to end  
And every node points at a profile that exists  
When I run `rune graph check` for that graph  
Then the command succeeds  
And it prints the ordered path of nodes

### Scenario: Check fails when a profile is missing

Given a graph node references a profile that does not exist  
When I run `rune graph check` for that graph  
Then the command fails  
And the message names the node and the missing profile

### Scenario: Check fails when the graph branches

Given a graph where one node has more than one outgoing connection  
When I run `rune graph check` for that graph  
Then the command fails  
And the message explains the linearity problem

### Scenario: Check fails when the graph has a cycle

Given a graph whose connections form a loop  
When I run `rune graph check` for that graph  
Then the command fails  
And the message indicates a cycle

### Scenario: Check fails for an unknown graph

Given no graph file exists for the given id  
When I run `rune graph check` for that id  
Then the command fails  
And the message says the graph was not found

### Scenario: List graphs from the CLI

Given valid graph files exist on disk  
When I run `rune graph list`  
Then I see those graphs listed

### Scenario: Show one graph from the CLI

Given a valid graph file exists  
When I run `rune graph show` for that graph  
Then I see that graph's details

### Scenario: Check does not call any model

Given a graph ready to validate  
When I run `rune graph check`  
Then validation completes without starting any agent or model call

---

## D — Graph run CLI

### Scenario: Run a linear graph and print only the final answer

Given a valid linear graph with two or three nodes and real profiles  
When I run `rune graph run` with a prompt  
Then only the last node's answer appears on standard output  
And the command succeeds

### Scenario: Each node inherits the previous answer

Given a two-node linear graph where the second node has insert and append text  
When I run the graph with an initial prompt  
Then the first node receives the initial prompt (plus its own insert/append if any)  
And the second node receives the first node's final answer wrapped by its insert and append

### Scenario: Verbose progress goes to stderr only

Given a valid graph ready to run  
When I run it with `--verbose`  
Then progress lines appear on standard error  
And standard output still contains only the final answer

### Scenario: Optional log file records every step

Given a valid graph ready to run  
When I run it with `--log` pointing at a file  
Then that file contains the full run record with each step's input and output  
And the final answer still prints on standard output

### Scenario: Invalid graph never starts models

Given a graph that fails the same checks as `graph check`  
When I run `rune graph run` for that graph  
Then the command fails before any model is called  
And the errors match the check-style messages

### Scenario: Prompt is required

Given I invoke `rune graph run` without `--prompt` or `--prompt-file`  
When the command starts  
Then it fails with a usage error

### Scenario: Prompt and prompt-file are exclusive

Given I pass both `--prompt` and `--prompt-file`  
When I run `rune graph run`  
Then the command fails with a usage error

### Scenario: Mid-chain failure keeps partial results in the log

Given a multi-node graph where a later node fails during the run  
When I run it with `--log` set  
Then the command exits with failure  
And the log keeps completed steps and marks the failed step

---

## E — Retarget links to graph edges

### Scenario: Topology lives only in graph edges

Given graphs define connections as edges between nodes  
When I look for how workflows are connected  
Then those graph edges are the only topology  
And there is no global links file in use

### Scenario: Old link CLI commands are gone

Given the product no longer supports global profile links  
When I try `rune link` commands  
Then the command is unknown  
And help no longer lists link commands

### Scenario: Old link HTTP endpoints are gone

Given the API no longer exposes a links surface  
When a client calls the former links routes  
Then those routes are not handled

### Scenario: SDK no longer offers link types or methods

Given a consumer uses the Rune SDK  
When they look for link types or link client methods  
Then those exports and methods are not available

### Scenario: Web does not call dead link APIs

Given the web app no longer manages global links  
When the app builds and runs  
Then it does not call link client APIs  
And any former link UI is removed, hidden, or replaced with a short notice

### Scenario: Docs and README describe graphs only

Given links are retired in favor of graphs  
When someone reads the README or CLI help  
Then workflow topology is described via graphs  
And links file or `rune link` examples are gone

### Scenario: Profiles and graphs still work after cutover

Given global links have been removed  
When I use profile create/read/update/delete and graph load/check/run  
Then those flows still work as before

### Scenario: Profile delete no longer depends on links

Given a profile is deleted  
When delete runs  
Then it does not read or write a global links file
