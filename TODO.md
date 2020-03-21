
- must save best snapshots, otherwise resizing will overwrite best one
- after having snapshots, keep the best 100 and show them on the UI
- % reported for fwds looks too low (review code)
- allow for more server nodes

- focus placement strategy:
  - player positions
  - bounding box
- metrics
  - fwds/sec
  - fwds/sec without partitioning
  - runs/sec
- controls
  - select number of partitions
  - select strategy (bounding box vs player positions)
  - max comfortable threshold
  - edit focus positions
    - show if attempt was successful or not, but always show
