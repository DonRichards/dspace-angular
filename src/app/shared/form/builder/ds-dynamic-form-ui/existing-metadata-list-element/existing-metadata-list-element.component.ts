import { Component, EventEmitter, Input, OnChanges, OnDestroy } from '@angular/core';
import { AbstractControl, FormControl } from '@angular/forms';
import { DynamicFormControlEvent } from '@ng-dynamic-forms/core';
import { Store } from '@ngrx/store';
import { Observable, of as observableOf, Subject, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AppState } from '../../../../../app.reducer';
import { RelationshipService } from '../../../../../core/data/relationship.service';
import { RemoteData } from '../../../../../core/data/remote-data';
import { Relationship } from '../../../../../core/shared/item-relationships/relationship.model';
import { Item } from '../../../../../core/shared/item.model';
import { ItemMetadataRepresentation } from '../../../../../core/shared/metadata-representation/item/item-metadata-representation.model';
import { MetadataRepresentation } from '../../../../../core/shared/metadata-representation/metadata-representation.model';
import { MetadataValue } from '../../../../../core/shared/metadata.models';
import {
  getAllSucceededRemoteData,
  getRemoteDataPayload,
  getSucceededRemoteData
} from '../../../../../core/shared/operators';
import { hasValue, isNotEmpty } from '../../../../empty.util';
import { ItemSearchResult } from '../../../../object-collection/shared/item-search-result.model';
import { SelectableListService } from '../../../../object-list/selectable-list/selectable-list.service';
import { FormFieldMetadataValueObject } from '../../models/form-field-metadata-value.model';
import { RelationshipOptions } from '../../models/relationship-options.model';
import { DynamicConcatModel } from '../models/ds-dynamic-concat.model';
import { RemoveRelationshipAction } from '../relation-lookup-modal/relationship.actions';

export abstract class Reorderable {

  constructor(public oldIndex?: number, public newIndex?: number) {
  }

  abstract getId(): string;

  abstract getPlace(): number;

  abstract update(): Observable<any>;

  get hasMoved(): boolean {
    return this.oldIndex !== this.newIndex
  }
}

export class ReorderableFormFieldMetadataValue extends Reorderable {

  constructor(
    public metadataValue: FormFieldMetadataValueObject,
    public model: DynamicConcatModel,
    public control: FormControl,
    oldIndex?: number,
    newIndex?: number
  ) {
    super(oldIndex, newIndex);
    this.metadataValue = metadataValue;
  }

  getId(): string {
    if (hasValue(this.metadataValue.authority)) {
      return this.metadataValue.authority;
    } else {
      // can't use UUIDs, they're generated client side
      return this.metadataValue.value;
    }
  }

  getPlace(): number {
    return this.metadataValue.place;
  }

  update(): Observable<FormFieldMetadataValueObject> {
    this.metadataValue.place = this.newIndex;
    this.model.valueUpdates.next(this.metadataValue as any);
    console.log('this.control.value', this.control.value);
    this.oldIndex = this.newIndex;
    return observableOf(this.metadataValue);
  }

}

export class ReorderableRelationship extends Reorderable {

  constructor(public relationship: Relationship, public useLeftItem: boolean, protected relationshipService: RelationshipService, oldIndex?: number, newIndex?: number) {
    super(oldIndex, newIndex);
    this.relationship = relationship;
    this.useLeftItem = useLeftItem;
  }

  getId(): string {
    return this.relationship.id;
  }

  getPlace(): number {
    if (this.useLeftItem) {
      return this.relationship.rightPlace
    } else {
      return this.relationship.leftPlace
    }
  }

  update(): Observable<RemoteData<Relationship>> {
    const updatedRelationship$ = this.relationshipService.updatePlace(this);

    updatedRelationship$.pipe(
      getSucceededRemoteData()
    ).subscribe(() => {
      this.oldIndex = this.newIndex;
    });

    return updatedRelationship$;
  }
}

@Component({
  selector: 'ds-existing-metadata-list-element',
  templateUrl: './existing-metadata-list-element.component.html',
  styleUrls: ['./existing-metadata-list-element.component.scss']
})
export class ExistingMetadataListElementComponent implements OnChanges, OnDestroy {
  @Input() listId: string;
  @Input() submissionItem: Item;
  @Input() reoRel: ReorderableRelationship;
  @Input() metadataFields: string[];
  @Input() relationshipOptions: RelationshipOptions;
  metadataRepresentation: MetadataRepresentation;
  relatedItem: Item;

  /**
   * List of subscriptions to unsubscribe from
   */
  private subs: Subscription[] = [];

  constructor(
    private selectableListService: SelectableListService,
    private store: Store<AppState>
  ) {
  }

  ngOnChanges() {
    const item$ = this.reoRel.useLeftItem ?
      this.reoRel.relationship.leftItem : this.reoRel.relationship.rightItem;

    this.subs.push(item$.pipe(
      getAllSucceededRemoteData(),
      getRemoteDataPayload(),
      filter((item: Item) => hasValue(item) && isNotEmpty(item.uuid))
    ).subscribe((item: Item) => {
      this.relatedItem = item;
      const relationMD: MetadataValue = this.submissionItem.firstMetadata(this.relationshipOptions.metadataField, { value: this.relatedItem.uuid });
      if (hasValue(relationMD)) {
        const metadataRepresentationMD: MetadataValue = this.submissionItem.firstMetadata(this.metadataFields, { authority: relationMD.authority });
        this.metadataRepresentation = Object.assign(
          new ItemMetadataRepresentation(metadataRepresentationMD),
          this.relatedItem
        )
      }
    }));
  }

  removeSelection() {
    this.selectableListService.deselectSingle(this.listId, Object.assign(new ItemSearchResult(), { indexableObject: this.relatedItem }));
    this.store.dispatch(new RemoveRelationshipAction(this.submissionItem, this.relatedItem, this.relationshipOptions.relationshipType))
  }

  /**
   * Unsubscribe from all subscriptions
   */
  ngOnDestroy(): void {
    this.subs
      .filter((sub) => hasValue(sub))
      .forEach((sub) => sub.unsubscribe());
  }

}
