<script setup>
import { ref, watch, onMounted } from 'vue'
import { Users, Save, AlertCircle, Plus, Trash2, ChevronDown, ChevronUp, GripVertical } from 'lucide-vue-next'
import api from '../../services/api'

const props = defineProps({
  county: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['save'])

// Contacts from the expandable table
const contacts = ref([])
const contactTypes = ref(['primary', 'secondary', 'billing', 'technical', 'emergency', 'other'])
const isLoading = ref(false)
const expandedContacts = ref({})

const hasChanges = ref(false)
const isSaving = ref(false)
const error = ref('')

// Watch for county changes to reload contacts
watch(() => props.county, async (newCounty) => {
  if (newCounty?.research_id) {
    await loadContacts(newCounty.research_id)
    hasChanges.value = false
  }
}, { immediate: true })

// Load contacts from API
async function loadContacts(researchId) {
  isLoading.value = true
  try {
    const response = await api.getContacts(researchId)
    contacts.value = response.data.contacts || []
    // Expand first contact by default
    if (contacts.value.length > 0) {
      expandedContacts.value[contacts.value[0].id] = true
    }
  } catch (err) {
    console.error('Failed to load contacts:', err)
  } finally {
    isLoading.value = false
  }
}

// Load contact types
onMounted(async () => {
  try {
    const response = await api.getContactTypes()
    if (response.data.types?.length > 0) {
      contactTypes.value = response.data.types
    }
  } catch (err) {
    console.error('Failed to load contact types:', err)
  }
})

// Toggle contact expansion
function toggleContact(id) {
  expandedContacts.value[id] = !expandedContacts.value[id]
}

// Add new contact
async function addContact() {
  try {
    const response = await api.createContact(props.county.research_id, {
      contact_type: 'secondary',
      sort_order: contacts.value.length
    })
    contacts.value.push(response.data.contact)
    expandedContacts.value[response.data.contact.id] = true
    hasChanges.value = true
  } catch (err) {
    error.value = 'Failed to add contact'
  }
}

// Update contact field
function updateContactField(contact, field, value) {
  contact[field] = value
  hasChanges.value = true
}

// Delete contact
async function deleteContact(contact) {
  if (!confirm(`Delete this ${contact.contact_type} contact?`)) return

  try {
    await api.deleteContact(contact.id)
    contacts.value = contacts.value.filter(c => c.id !== contact.id)
    hasChanges.value = true
  } catch (err) {
    error.value = 'Failed to delete contact'
  }
}

// Get contact type label
function getContactTypeLabel(type) {
  const labels = {
    primary: 'Primary Contact',
    secondary: 'Secondary Contact',
    billing: 'Billing Contact',
    technical: 'Technical Contact',
    emergency: 'Emergency Contact',
    other: 'Other Contact'
  }
  return labels[type] || type
}

// Save handler
async function handleSave() {
  isSaving.value = true
  error.value = ''

  try {
    // Save all contacts
    for (const contact of contacts.value) {
      await api.updateContact(contact.id, {
        contact_type: contact.contact_type,
        sort_order: contact.sort_order,
        name: contact.name,
        title: contact.title,
        phone: contact.phone,
        email: contact.email,
        physical_address: contact.physical_address,
        mailing_address: contact.mailing_address,
        general_phone: contact.general_phone,
        fax: contact.fax,
        website: contact.website,
        tax_search_website: contact.tax_search_website,
        notes: contact.notes
      })
    }

    hasChanges.value = false
  } catch (err) {
    error.value = 'Failed to save changes. Please try again.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="max-w-4xl">
    <!-- Error message -->
    <div v-if="error" class="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
      <AlertCircle class="w-5 h-5 flex-shrink-0" />
      <span class="text-sm">{{ error }}</span>
    </div>

    <div class="space-y-6">
      <!-- Contacts Card -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div class="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Contacts</h3>
            <p class="text-sm text-gray-500 mt-1">Manage contact information for this jurisdiction</p>
          </div>
          <button
            @click="addContact"
            class="btn btn-primary btn-sm"
          >
            <Plus class="w-4 h-4" />
            Add Contact
          </button>
        </div>

        <div class="p-6">
          <div v-if="isLoading" class="text-center py-8 text-gray-500">
            Loading contacts...
          </div>

          <div v-else-if="contacts.length === 0" class="text-center py-8 text-gray-500">
            No contacts configured. Click "Add Contact" to create one.
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="contact in contacts"
              :key="contact.id"
              class="border border-gray-200 rounded-lg overflow-hidden"
            >
              <!-- Contact Header -->
              <div
                @click="toggleContact(contact.id)"
                class="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100"
              >
                <div class="flex items-center gap-3">
                  <GripVertical class="w-4 h-4 text-gray-400 cursor-move" />
                  <component
                    :is="expandedContacts[contact.id] ? ChevronUp : ChevronDown"
                    class="w-4 h-4 text-gray-500"
                  />
                  <div>
                    <span class="font-medium text-gray-900">
                      {{ contact.name || getContactTypeLabel(contact.contact_type) }}
                    </span>
                    <span v-if="contact.name" class="text-sm text-gray-500 ml-2">
                      ({{ contact.contact_type }})
                    </span>
                  </div>
                </div>
                <button
                  @click.stop="deleteContact(contact)"
                  class="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                  title="Delete contact"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>

              <!-- Contact Details (expandable) -->
              <div v-if="expandedContacts[contact.id]" class="p-4 space-y-6">
                <!-- Contact Type & Name Row -->
                <div class="grid grid-cols-3 gap-4">
                  <div>
                    <label class="input-label">Contact Type</label>
                    <select
                      :value="contact.contact_type"
                      @change="updateContactField(contact, 'contact_type', $event.target.value)"
                      class="input"
                    >
                      <option v-for="type in contactTypes" :key="type" :value="type">
                        {{ getContactTypeLabel(type) }}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label class="input-label">Name</label>
                    <input
                      :value="contact.name"
                      @input="updateContactField(contact, 'name', $event.target.value)"
                      type="text"
                      placeholder="Contact name"
                      class="input"
                    />
                  </div>

                  <div>
                    <label class="input-label">Title</label>
                    <input
                      :value="contact.title"
                      @input="updateContactField(contact, 'title', $event.target.value)"
                      type="text"
                      placeholder="e.g., County Treasurer"
                      class="input"
                    />
                  </div>
                </div>

                <!-- Phone & Email Row -->
                <div class="grid grid-cols-3 gap-4">
                  <div>
                    <label class="input-label">Direct Phone</label>
                    <input
                      :value="contact.phone"
                      @input="updateContactField(contact, 'phone', $event.target.value)"
                      type="text"
                      placeholder="(555) 123-4567"
                      class="input"
                    />
                  </div>

                  <div>
                    <label class="input-label">General Phone</label>
                    <input
                      :value="contact.general_phone"
                      @input="updateContactField(contact, 'general_phone', $event.target.value)"
                      type="text"
                      placeholder="(555) 123-4567"
                      class="input"
                    />
                  </div>

                  <div>
                    <label class="input-label">Fax</label>
                    <input
                      :value="contact.fax"
                      @input="updateContactField(contact, 'fax', $event.target.value)"
                      type="text"
                      placeholder="(555) 123-4567"
                      class="input"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="input-label">Email</label>
                    <input
                      :value="contact.email"
                      @input="updateContactField(contact, 'email', $event.target.value)"
                      type="email"
                      placeholder="email@example.com"
                      class="input"
                    />
                  </div>
                </div>

                <!-- Addresses -->
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="input-label">Physical Address</label>
                    <textarea
                      :value="contact.physical_address"
                      @input="updateContactField(contact, 'physical_address', $event.target.value)"
                      rows="3"
                      placeholder="Street address..."
                      class="input"
                    ></textarea>
                  </div>

                  <div>
                    <label class="input-label">Mailing Address</label>
                    <textarea
                      :value="contact.mailing_address"
                      @input="updateContactField(contact, 'mailing_address', $event.target.value)"
                      rows="3"
                      placeholder="P.O. Box or mailing address..."
                      class="input"
                    ></textarea>
                  </div>
                </div>

                <!-- Websites -->
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="input-label">Agency Website</label>
                    <input
                      :value="contact.website"
                      @input="updateContactField(contact, 'website', $event.target.value)"
                      type="url"
                      placeholder="https://..."
                      class="input"
                    />
                  </div>

                  <div>
                    <label class="input-label">Tax Search Website</label>
                    <input
                      :value="contact.tax_search_website"
                      @input="updateContactField(contact, 'tax_search_website', $event.target.value)"
                      type="url"
                      placeholder="https://..."
                      class="input"
                    />
                  </div>
                </div>

                <!-- Notes -->
                <div>
                  <label class="input-label">Notes</label>
                  <textarea
                    :value="contact.notes"
                    @input="updateContactField(contact, 'notes', $event.target.value)"
                    rows="2"
                    placeholder="Additional notes..."
                    class="input"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between">
        <p v-if="hasChanges" class="text-sm text-amber-600">You have unsaved changes</p>
        <p v-else class="text-sm text-gray-500">All changes saved</p>

        <button
          @click="handleSave"
          :disabled="!hasChanges || isSaving"
          class="btn btn-primary"
        >
          <Save class="w-4 h-4" />
          {{ isSaving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </div>
  </div>
</template>
